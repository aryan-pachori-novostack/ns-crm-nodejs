# uploadBankFileData.js - Line-by-Line Explanation

## Overview
This file processes bank file uploads from Excel files. It validates data, handles different header configurations, uploads error reports to S3, and inserts valid data into the database.

---

## Imports and Dependencies (Lines 1-6)

```javascript
const { logger } = require("../../api/helpers/logger");
const { uploadArrayToS3 } = require("../../api/helpers/commonhelper");
const { sequelize, _db2 } = require('../db');
const { QueryTypes } = require('sequelize');
const { searchFreshLeadClaims, upsertTentativeMatchMeta } = require('../../api/services/finance-services');
const { v4: uuid } = require('uuid');
```

- **Line 1**: Imports logger for application logging
- **Line 2**: Imports `uploadArrayToS3` helper function to upload error reports to AWS S3
- **Line 3**: Imports database connections (`sequelize` for main DB, `_db2` for secondary DB)
- **Line 4**: Imports Sequelize query types (SELECT, INSERT, UPDATE)
- **Line 5**: Imports functions to search for matching lead claims and update match metadata
- **Line 6**: Imports UUID generator for creating unique bank file IDs

---

## Excel Header Definitions (Lines 8-59)

```javascript
const EXCEL_HEADERS = {
    'Sr No': { instruction: 'IGNORE', dbField: null },
    'Month': { instruction: 'MANDATORY', dbField: null },
    'Loan Ac No': { instruction: 'MANDATORY', dbField: 'loan_number' },
    // ... more headers
};
```

### What Happens with Different Headers?

**This is the KEY configuration that determines how the file handles different Excel headers:**

1. **Header Recognition**: The system expects specific header names exactly as defined in `EXCEL_HEADERS`
2. **Three Instruction Types**:
   - `'IGNORE'`: Column exists but is not processed (e.g., 'Sr No', 'Team')
   - `'MANDATORY'`: Column must have a value, row validation will fail if empty (row is skipped, processing continues)
   - `'OPTIONAL'`: Column can be empty, but if present, value is processed

3. **What Happens if Headers Don't Match?**
   - If an Excel file has headers that **don't exist** in `EXCEL_HEADERS`:
     - They are **ignored** during validation
     - They are **not processed** during data insertion
     - They **may appear** in the error report but won't cause validation failures
   
   - If an Excel file has rows **missing MANDATORY header values**:
     - Validation will fail for those specific rows missing mandatory fields
     - Error messages like "Loan Ac No is mandatory" will be generated for those rows
     - Invalid rows are skipped and added to the error report, but processing continues for valid rows
     - Valid rows are still processed and inserted into the database

4. **Additional Mappings (Lines 62-69)**: 
   - Some headers may exist in data but aren't in the main spec
   - These are mapped separately but follow similar rules

---

## Validation Helper Functions (Lines 71-143)

### `isEmptyValue()` (Lines 74-77)
```javascript
function isEmptyValue(value) {
    return value === null || value === undefined || value === '' ||
        (typeof value === 'string' && value.trim() === '');
}
```
- Checks if a value is empty (null, undefined, empty string, or whitespace-only string)
- Used throughout validation to determine if mandatory fields are present

### `validateMandatoryField()` (Lines 79-84)
```javascript
function validateMandatoryField(value, headerName) {
    if (isEmptyValue(value)) {
        return `${headerName} is mandatory`;
    }
    return null;
}
```
- Validates that a mandatory field has a value
- Returns error message if empty, null if valid

### `validateRow()` (Lines 92-124)
```javascript
function validateRow(row, rowIndex) {
    const errors = [];
    // ... validation logic
}
```

**What happens with different headers here:**
- **Line 97**: Iterates through `EXCEL_HEADERS` (not the actual Excel headers)
- **Line 105**: Gets value using `row[headerName]` - if header doesn't exist, `value` will be `undefined`
- **Line 108-112**: For MANDATORY fields, if value is undefined/empty, error is added
- **Result**: If Excel has different header names, mandatory fields will be treated as missing and that specific row's validation will fail

**Example Scenario:**
- Excel has header: `"Loan Account Number"` 
- System expects: `"Loan Ac No"`
- Result: `row['Loan Ac No']` returns `undefined`, that row's validation fails with "Loan Ac No is mandatory"
- **Behavior**: The row with the error is skipped and added to the error report, but processing continues for other rows

### `validateAllRows()` (Lines 131-143)
- Validates all rows in the dataset (utility function)
- Returns `{ isValid: boolean, errors: Array }`
- If any row has errors, `isValid` is false
- **Note**: This function exists but is not currently used. Row-by-row validation is done using `validateRow()` during batch processing instead.

---

## Date Conversion Functions (Lines 145-221)

### `excelDateToJSDate()` (Lines 150-182)
- Converts Excel date serial numbers to JavaScript Date objects
- Handles multiple formats: Excel serial numbers, date strings with `/` or `-`
- Returns null if date is invalid

### `getMappedDateValue()` (Lines 204-221)
- Gets date value from a row and formats it as `DD/MM/YY`
- Uses `excelDateToJSDate()` for conversion
- Returns null if date is empty or invalid

---

## Data Processing Functions (Lines 184-247)

### `getMappedValue()` (Lines 190-196)
```javascript
function getMappedValue(row, headerName) {
    const value = row[headerName];
    if (isEmptyValue(value)) {
        return null;
    }
    return String(value);
}
```

**What happens with different headers:**
- If `headerName` doesn't exist in `row`, `value` is `undefined`
- Function returns `null` (treated as empty/optional)
- This is why mandatory fields must be validated separately

### `trimObject()` (Lines 223-247)
- Trims whitespace from object keys and string values
- Handles arrays of objects
- Ensures consistent data format before processing

---

## Main Processing Function (Lines 249-652)

### Initial Setup (Lines 250-264)

```javascript
let { data, file_name, user } = job.data;
```

- Extracts job data: Excel data array, filename, and user info
- `data` is expected to be an array of objects where keys are Excel headers

### Duplicate Check (Lines 254-257)

```javascript
let fileAlreadyExistsQuery = ` SELECT * FROM application_logs ... `;
```

- Checks if the same file was uploaded in the last 5 minutes
- Prevents duplicate processing

### Initial Log Entry (Lines 259-261)

```javascript
query = ` insert into application_logs ... `;
```

- Creates initial log entry before processing starts
- Will be updated later with S3 link and results

### Data Trimming (Line 264)

```javascript
let dataNew = trimObject(data);
```

- Trims all whitespace from headers and values
- Normalizes data format

---

## Validation Phase (Lines 266-270)

### Step 1: Row-by-Row Validation During Processing

**IMPORTANT CHANGE:** Validation is now done row-by-row during batch processing, not upfront. Invalid rows are skipped and added to the error report, but processing continues for valid rows.

**What happens with different headers during validation:**

1. **Validation Process (Per Row):**
   - Each row is validated individually before processing
   - System iterates through `EXCEL_HEADERS` keys (expected headers)
   - For each expected header, checks if value exists in Excel row
   - If Excel row doesn't have that header, `row[headerName]` returns `undefined`

2. **Mandatory Field Validation:**
   - If a MANDATORY header is missing from Excel row → **that specific row fails validation**
   - Error message: `"[Header Name] is mandatory"`
   - Example: Excel row missing "Loan Ac No" → Error: "Loan Ac No is mandatory"
   - **The row is skipped, but processing continues for other rows**

3. **Optional Fields:**
   - Missing optional headers don't cause validation errors
   - They're simply treated as null/empty

4. **Extra Headers in Excel:**
   - Headers not in `EXCEL_HEADERS` are ignored during validation
   - They won't cause validation failures
   - They may appear in error reports but won't be processed

### Error Handling When Row Validation Fails

```javascript
// Inside processBatch function, for each row:
const rowErrors = validateRow(row, startIndex + i);
if (rowErrors.length > 0) {
    row.error = rowErrors.join('; ');
    userDetailsError.push(row);
    failureCount++;
    continue; // Skip this row and continue with next row
}
```

**What happens:**
- Row with validation errors is added to error report with error message
- Row is skipped from database insertion
- Processing continues with next row
- All rows (valid and invalid) are included in final S3 error report

---

## Data Lookup Phase (Lines 314-381)

### Step 1.5: Collect Unique IDs (Lines 317-333)

```javascript
const uniqueBankIds = new Set();
const uniqueProductIds = new Set();
const uniqueStates = new Set();

for (let i = 0; i < dataNew.length; i++) {
    const bankId = getMappedValue(dataNew[i], 'Bank/NBFC ID');
    const productId = getMappedValue(dataNew[i], 'Sub Product ID');
    const state = getMappedValue(dataNew[i], 'State');
    // ...
}
```

**What happens with different headers:**
- Uses `getMappedValue()` which returns `null` if header doesn't exist
- If "Bank/NBFC ID" header is missing → `bankId` is `null`
- If "Sub Product ID" header is missing → `productId` is `null`
- These would have been caught in validation (if mandatory), but if optional, processing continues

### Step 1.6: Batch Fetch (Lines 335-381)

```javascript
// Fetch all banks
const bankQuery = `SELECT ... FROM ru_netsuite_banks WHERE netsuite_bank_id IN (...)`;
const banks = await _db2.query(bankQuery, ...);

// Create map
for (const bank of banks) {
    bankMap.set(bank.netsuite_bank_id, bank);
}
```

- Fetches all banks/products/states in batch queries (performance optimization)
- Creates Maps for O(1) lookup during row processing
- If IDs are missing or invalid, rows will fail during processing phase

---

## Batch Processing Phase (Lines 340-590)

### Process Batch Function (Lines 347-590)

**For each row in batch:**

#### 0. Validate Row First (Lines 362-370)
```javascript
// Validate row - if validation fails, skip this row and continue
const rowErrors = validateRow(row, startIndex + i);
if (rowErrors.length > 0) {
    row.error = rowErrors.join('; ');
    userDetailsError.push(row);
    failureCount++;
    continue; // Skip this row and continue with next row
}
```

**What happens:**
- Each row is validated before any processing
- If validation fails, row is added to error report and skipped
- Processing continues with next row

#### 1. Get IDs from Row (Lines 375-377)
```javascript
const bankId = getMappedValue(row, 'Bank/NBFC ID');
const productId = getMappedValue(row, 'Sub Product ID');
const state = getMappedValue(row, 'State');
```

**What happens with different headers:**
- If headers don't match → `getMappedValue()` returns `null`
- Processing continues but may fail later

#### 2. Bank Lookup (Lines 419-429)
```javascript
if (bankId) {
    const bank = bankMap.get(bankId);
    if (!bank) {
        row.error = `Bank/NBFC not found for ID ${bankId}`;
        userDetailsError.push(row);
        failureCount++;
        continue;
    }
    bankName = bank.bank_name;
}
```

- If `bankId` is null (header missing) → skips lookup, `bankName` stays null
- If `bankId` exists but not in database → row marked as error, added to error list
- Row is skipped from insertion

#### 3. Product Lookup (Lines 431-444)
- Similar to bank lookup
- Also gets `parentProductId` if available

#### 4. State Validation (Lines 446-455)
```javascript
if (state) {
    const normalizedState = state.toUpperCase().trim();
    if (!validStatesSet.has(normalizedState)) {
        row.error = `Invalid state: ${state}...`;
        userDetailsError.push(row);
        failureCount++;
        continue;
    }
}
```

- Validates state against database of valid states
- If invalid → row marked as error

#### 5. Lead Matching (Lines 460-490)
```javascript
matchResult = await searchFreshLeadClaims(
    customerFirstName,
    customerLastName,
    // ...
);
```

- Attempts to match bank file row with existing lead claims
- Uses customer name, loan numbers, bank/product IDs
- If match found, updates tentative match metadata

#### 6. Add to Valid Rows (Lines 497-499)
```javascript
validRows.push({ row, bankName, productName, ... });
row.error = '';
userDetailsError.push(row);
```

- Valid rows are added to `validRows` array
- All rows (valid + invalid) are added to `userDetailsError` for S3 report
- Valid rows have `error = ''`, invalid rows have error messages

#### 7. Database Insert (Lines 463-565)
```javascript
queryString = ` INSERT IGNORE INTO ru_dsa_tentative_bank_files (...) VALUES (...) `;
```

- Builds batch INSERT query for all valid rows using `INSERT IGNORE`
- `INSERT IGNORE` automatically skips duplicate rows at database level (no error thrown)
- Uses mapped values from Excel headers
- If header doesn't exist → `getMappedValue()` returns `null` → inserts NULL into database
- All rows in a batch (up to 100) are inserted in a single query

**What happens with different headers during insert:**
- Missing headers → NULL values inserted (if optional)
- Missing mandatory headers → Would have failed validation earlier
- Extra headers → Ignored, not inserted
- Duplicate rows → Automatically skipped by `INSERT IGNORE` (no error, row not inserted)

---

## Query Count Analysis

### Queries Per File (Not Per Record)

These queries run once per file upload, regardless of number of records:

1. **File Duplicate Check** (Line 245-246): 1 query
   - Checks if same file was uploaded in last 5 minutes
   - Prevents duplicate file processing

2. **Initial Log Entry** (Line 250-251): 1 query
   - Creates log entry in `application_logs` table

3. **Batch Fetch Banks** (Line 291-292): 1 query
   - Fetches all unique banks in one query using `IN` clause
   - Cached in `bankMap` for O(1) lookup per row

4. **Batch Fetch Products** (Line 305-306): 1 query
   - Fetches all unique products in one query using `IN` clause
   - Cached in `productMap` for O(1) lookup per row

5. **Fetch Valid States** (Line 317-318): 1 query
   - Fetches all valid states from `pincodes_list` table
   - Cached in `validStatesSet` for O(1) lookup per row

6. **Final Log Update** (Line 592-596): 1 query
   - Updates `application_logs` with S3 link, success/failure counts

**Total per file: 6 queries** (regardless of number of records)

### Queries Per Record

For each valid record (row that passes validation):

1. **Lead Matching Query** (Line 432, via `searchFreshLeadClaims`): **1 query per record**
   - Searches for matching fresh lead claims
   - Only runs if all required fields are present (customer names, bank ID, product IDs, loan numbers)
   - Uses `SELECT` with JOIN on `ru_fresh_lead_claims` and `ru_fresh_lead_claims_meta`

2. **Tentative Match Meta Upsert** (Line 473, via `upsertTentativeMatchMeta`): **0-1 query per record**
   - Only runs if lead match is found (`matchResult.is_matched === true`)
   - Uses `INSERT ... ON DUPLICATE KEY UPDATE` to upsert match metadata
   - Updates `ru_fresh_lead_claims_meta` table

**Total per record:**
- **Minimum: 1 query** (if no lead match found)
- **Maximum: 2 queries** (if lead match found)
- **Average: ~1-2 queries** (depends on match rate)

### Queries Per Batch

1. **Batch Insert** (Line 560-563): **1 query per batch**
   - Inserts all valid rows in batch (up to 100 rows) using `INSERT IGNORE`
   - Single query handles entire batch, duplicates automatically skipped

**Total per batch: 1 query** (for up to 100 records)

### Performance Optimization Summary

**Optimizations Implemented:**

1. **Batch Lookups**: Banks, products, and states fetched once per file, not per record
2. **Batch Inserts**: Up to 100 records inserted in single query
3. **INSERT IGNORE**: Duplicates handled at database level, no error handling needed
4. **Cached Maps**: O(1) lookups for banks/products/states using JavaScript Maps/Sets
5. **Parallel Processing**: Multiple batches processed in parallel using `Promise.all`

**Example for 1000 records:**
- File-level queries: 6 queries
- Per-record queries: ~1000-2000 queries (1-2 per record)
- Batch insert queries: ~10 queries (1 per 100 records)
- **Total: ~1016-2016 queries** (much better than individual inserts per record)

---

## Final Error Report Upload (Lines 590-597)

```javascript
let file = await uploadArrayToS3(userDetailsError, "result_tentative_bank_file_upload");
query = ` update application_logs set field = ?, from_value = ?, to_value = ?, ... `;
await sequelize.query(query, {
    replacements: [file, successCount, failureCount, ...]
});
```

- Uploads final report with all rows (successful + failed)
- Updates `application_logs`:
  - `field`: S3 link to report file
  - `from_value`: Success count
  - `to_value`: Failure count

---

## Summary: What Happens with Different Headers

### Scenario 1: Excel Has Extra Headers
- **Result**: Extra headers are ignored
- **Validation**: Passes (if mandatory headers present)
- **Processing**: Extra columns not inserted into database
- **Error Report**: Extra columns appear in S3 report but marked as ignored

### Scenario 2: Excel Missing Optional Headers
- **Result**: Processing continues
- **Validation**: Passes
- **Processing**: NULL values inserted for missing optional fields
- **Error Report**: No errors for missing optional fields

### Scenario 3: Excel Missing Mandatory Headers (Per Row)
- **Result**: Only rows with missing mandatory headers are skipped
- **Validation**: Row fails validation with error messages like "Loan Ac No is mandatory"
- **Processing**: Invalid rows are skipped, valid rows are processed and inserted
- **Error Report**: Uploaded to S3 with validation errors in `error` column for failed rows
- **Database**: Valid rows are inserted, `application_logs.field` contains S3 link with all rows (valid + invalid)

### Scenario 4: Excel Has Different Header Names
- **Result**: Headers not recognized
- **Validation**: Fails if renamed header was mandatory
- **Processing**: Values not extracted, treated as missing
- **Error Report**: Shows validation errors for missing mandatory fields

### Scenario 5: Excel Has Typo in Header Name
- **Result**: Header not recognized (case-sensitive matching)
- **Example**: "Loan Ac No" vs "Loan AC No" → treated as missing
- **Validation**: Fails if mandatory
- **Processing**: Value not extracted

### Scenario 6: Duplicate Records in Database
- **Result**: Duplicate rows are automatically skipped
- **Processing**: Uses `INSERT IGNORE` - duplicates are silently skipped at database level
- **Behavior**: If a row with same `loan_number`, `apac_loan_number`, `file_date_iso`, and `netsuite_bank_id` already exists, it's skipped
- **Error Report**: Duplicate rows are not marked in error report (they're silently skipped)
- **Performance**: No error thrown, batch insert continues successfully for other rows

---

## Key Points

1. **Header Matching is Exact**: Headers must match `EXCEL_HEADERS` keys exactly (case-sensitive, whitespace-sensitive)

2. **Row-by-Row Validation**: Each row is validated individually during processing. Invalid rows are skipped but processing continues for valid rows.

3. **S3 Links Always Stored**: Both success and failure cases store S3 link in `application_logs.field`

4. **Error Reports Include All Rows**: Every row (successful or failed) appears in final S3 report with error column. Rows with validation errors have error messages, valid rows have empty error field.

5. **Batch Processing**: Data processed in batches of 100 rows for performance. Each batch is inserted in a single query.

6. **INSERT IGNORE for Duplicates**: Uses `INSERT IGNORE` to handle duplicates at database level. Duplicate rows are automatically skipped without throwing errors, allowing other rows in the batch to be inserted successfully.

7. **Optimized Database Queries**: 
   - Banks, products, and states fetched once per file (not per record)
   - Cached in Maps/Sets for O(1) lookups
   - Batch inserts reduce total query count significantly

8. **Query Count Per Record**: 
   - Minimum: 1 query (lead matching search)
   - Maximum: 2 queries (if lead match found, adds upsert query)
   - Batch insert: 1 query per 100 records

9. **Lead Matching**: Attempts to match bank file rows with existing lead claims. If match found, updates tentative match metadata.

10. **Partial Inserts Supported**: Invalid rows are skipped and added to error report, but valid rows are still inserted into the database. The system processes as many valid rows as possible. Duplicate rows are silently skipped by `INSERT IGNORE`.

