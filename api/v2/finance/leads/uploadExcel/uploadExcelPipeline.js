const ValidationPipeline = require("../../ValidationPipeline");
const { BaseValidator } = ValidationPipeline;
const LeadClaimError = require("../claims/LeadClaimError");
const { validatePan } = require("../../../../helpers/commonhelper");
const {
    VendorResolutionValidator,
    UploaderAuthorizationValidator,
    DsaStatusValidator,
    ConfirmationContactValidator,
    NsHierarchyEnrichmentValidator,
    RequestDateValidator,
    BankProductLockValidator,
    LoanApacRequiredValidator,
    DisbursementDateRequiredValidator,
    LoanApacFormatValidator,
    MandatoryFieldsValidator,
    TeamLeadPanValidator,
    ExternalPayoutAutofillValidator,
    PayoutTypeValidator,
    PayoutDetailsValidator,
    SplitCaseRequiredValidator,
    ConfirmationMailAllowedValidator,
    NetsuiteVendorIdValidator,
    RmUserResolutionValidator,
    DisbursementDateValidator,
    ContestValidator,
    FreshLeadExistValidator,
    DisbursementDateAgeValidator,
    MaxDisbursementAmountValidator,
    AdditionalLeadFormValidator,
    PayoutComputationValidator,
    BankFileMatchValidator,
    DuplicateLeadValidator,
    OnlineLeadValidator
} = require("../claims/claimValidators");

/**
 * Per-row pipeline: `context` is a LeadClaimContext.
 * With `onCustomError`, handles `type === "custom"` errors then stops that row,
 * leaving the batch loop free to continue with the next row.
 */
class UploadExcelPipeline extends ValidationPipeline {
    async run(context, onCustomError) {
        if (typeof onCustomError !== "function") {
            await super.run(context);
            return { aborted: false };
        }
        for (const validator of this.validators) {
            try {
                await validator.validate(context);
            } catch (error) {
                if (error?.type === "custom") {
                    await onCustomError(error, context);
                    return { aborted: true };
                }
                throw error;
            }
        }
        return { aborted: false };
    }
}
/** Vendor PAN present, well-formed, and normalized to uppercase on the row. */
class VendorPanValidator extends BaseValidator {
    async validate(ctx) {
        const rawPan = ctx.input.vendor_pan;
        if (!rawPan) {
            throw new LeadClaimError(`Vendor Pan Is Mandatory Field . `);
        }
        const pan = rawPan.trim().toUpperCase();
        if (!validatePan(pan)) {
            throw new LeadClaimError(`Vendor Pan Is Invalid . `);
        }
        ctx.input.vendor_pan = pan;
        ctx.derived.pan = pan;
    }
}

/** The full per-row validation order, mirroring the original processor top to bottom. */
const buildUploadExcelPipeline = () => new UploadExcelPipeline()
    .use(new VendorPanValidator())
    .use(new VendorResolutionValidator())
    .use(new UploaderAuthorizationValidator())
    .use(new DsaStatusValidator())
    .use(new ConfirmationContactValidator())
    .use(new NsHierarchyEnrichmentValidator())
    .use(new RequestDateValidator())
    .use(new BankProductLockValidator())
    .use(new LoanApacRequiredValidator())
    .use(new DisbursementDateRequiredValidator())
    .use(new LoanApacFormatValidator())
    .use(new MandatoryFieldsValidator())
    .use(new TeamLeadPanValidator())
    .use(new ExternalPayoutAutofillValidator())
    .use(new PayoutTypeValidator())
    .use(new PayoutDetailsValidator())
    .use(new SplitCaseRequiredValidator())
    .use(new ConfirmationMailAllowedValidator())
    .use(new NetsuiteVendorIdValidator())
    .use(new RmUserResolutionValidator())
    .use(new DisbursementDateValidator())
    .use(new ContestValidator())
    .use(new FreshLeadExistValidator())
    .use(new DisbursementDateAgeValidator())
    .use(new MaxDisbursementAmountValidator())
    .use(new AdditionalLeadFormValidator())
    .use(new PayoutComputationValidator())
    .use(new BankFileMatchValidator())
    .use(new DuplicateLeadValidator())
    .use(new OnlineLeadValidator());
module.exports = {
    UploadExcelPipeline,
    buildUploadExcelPipeline,
    VendorPanValidator
};
