//created dsa controller to serve the routes for RULOANS CUSTOMER DATA
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let ProductServices = require(_pathconst.ServicesPath.ProductServices);
let ProductValidationV1 = require(_pathconst.ReqModelsPath.ProductValidationV1);
const { createBulkLogQueue } = require("../../../../jobs");
const { checkWhereInQueryString, removeFormattingFromExcelBase64Async, decodeBase64AndReadXLSXForLeadForm } = require("../../../helpers/commonhelper");
const { logger } = require("../../../helpers/logger");
const xlsx = require('xlsx');


const getAllProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getAllProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, loan_type_filter, product_id_filter, product_name_filter, product_vendor_filter, loan_type_name_filter, promo_code_filter, joining_fee_filter, annual_fee_filter, status_name_filter, product_vendor_alias_filter, partner_link, privacy_policy_link, website_link, is_recommended_filter } = req?.body;
            if (!pageNumber) {
                pageNumber = 0
            };
            if (!pageSize) {
                pageSize = 10
            };
            let where = "";
            if (is_recommended_filter !== undefined && is_recommended_filter !== null && is_recommended_filter !== "") {
                const valStr = String(is_recommended_filter).trim().toLowerCase();
                const searchVal = (valStr === "yes" || valStr === "y" || valStr === "true" || valStr === "1") ? 1 : 0;
                where = checkWhereInQueryString(where);
                where += ` rlp.is_recommended = ${searchVal} `;
            }
            if (loan_type_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.loan_type_id = '${loan_type_filter}' `;
            };
            if (product_id_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.product_id = '${product_id_filter}' `;
            };
            if (product_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.product_description like '%${product_name_filter}%' `;
            };
            if (product_vendor_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.product_vendor like '%${product_vendor_filter}%' `;
            };
            if (product_vendor_alias_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.product_vendor_alias like '%${product_vendor_alias_filter}%' `;
            };
            if (loan_type_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlt.name like '%${loan_type_name_filter}%' `;
            };
            if (promo_code_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.promo_code like '%${promo_code_filter}%' `;
            };
            if (joining_fee_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.joining_fee like '%${joining_fee_filter}%' `;
            };
            if (annual_fee_filter) {
                where = checkWhereInQueryString(where);
                where += ` rlp.annual_fee like '%${annual_fee_filter}%' `;
            };
            if (partner_link) {
                where = checkWhereInQueryString(where);
                where += ` rlp.partner_link like '%${partner_link}%' `;
            };
            if (privacy_policy_link) {
                where = checkWhereInQueryString(where);
                where += ` rlp.privacy_policy_link like '%${privacy_policy_link}%' `;
            };
            if (website_link) {
                where = checkWhereInQueryString(where);
                where += ` rlp.website_link like '%${website_link}%' `;
            };
            if (status_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` case when rlp.status = 0 then "Inactive" else "Active" end like '%${status_name_filter}%' `;
            };

            let product = await ProductServices.getAllProduct(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        console.log(e)
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.createProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { is_recommended, id, loan_type_id } = req.body;
            const enableRecommended = is_recommended === true || is_recommended === 1 || is_recommended === "true" || is_recommended === "1";
            if (enableRecommended) {
                const count = await ProductServices.countRecommendedProducts(id, loan_type_id);
                if (count >= 4) {
                    return ResHelper.apiResponse(res, false, "Only 4 products can be recommended per loan type at a time.", 400, {}, "");
                }
            }
            let product = await ProductServices.createProduct(req.body, req?.loggedInUser?.id || null);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const addNewLender = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.addNewLender.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { lender_name } = req.body;
            let product = await ProductServices.addNewLender(lender_name);
            if (!product) {
                ResHelper.apiResponse(res, false, "Lender Already Exists", 200, {}, "");
                return
            }
            ResHelper.apiResponse(res, true, "Lender added Successfully", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getAllLoanTypes = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getAllLoanTypes.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.getAllLoanTypes(req?.body?.loan_type_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        };
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCriteria = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getCriteria.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, product_id } = req?.body;
            let product = await ProductServices.getCriteria(page_number * page_size, page_size, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getCriteriaByProductId = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getCriteria.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, product_id } = req?.body;
            let product = await ProductServices.getCriteria(null, null, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createCriteria = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.createCriteria.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.createCriteria(req.body, req?.loggedInUser?.id || null);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editCriteria = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.editCriteria.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.editCriteria(req.body, req?.loggedInUser?.id || null);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteCriteria = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteCriteria.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteCriteria(req.body, req?.loggedInUser?.id || null);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getContent = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, product_id } = req?.body;
            let product = await ProductServices.getContent(page_number * page_size, page_size, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createContent = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.createContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.createContent(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteContent = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteContent.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteContent(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getServiceablePincodes = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getServiceablePincodes.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { page_number, page_size, search } = req?.body;
            let where = "";
            if (search) {
                where += ` where pin_code like '%${search}%'`
            }
            let pincodes = await ProductServices.getServiceablePincodes(page_number * page_size, page_size, where);
            ResHelper.apiResponse(res, true, "Success", 200, pincodes, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const editServiceablePincodes = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.editServiceablePincodes.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let pincodes = await ProductServices.editServiceablePincodes(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, pincodes, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const addServiceablePincodes = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.addServiceablePincodes.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let pincodes = await ProductServices.addServiceablePincodes(req?.body);
            if (pincodes) {
                ResHelper.apiResponse(res, true, "Success", 200, pincodes, "");
            } else {
                ResHelper.apiResponse(res, false, "Pincode already exist", 200, {}, "");
            }
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteServiceablePincode = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteServiceablePincode.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let pincodes = await ProductServices.deleteServiceablePincode(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, pincodes, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDocuments = async (req, res, next) => {
    try {
        let document = await ProductServices.getDocuments();
        ResHelper.apiResponse(res, true, "Success", 200, document, "");
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDocumentsForProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getDocumentsForProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, product_id } = req?.body;
            if (!page_number) {
                page_number = 0
            }
            if (!page_size) {
                page_size = 10
            }
            let product = await ProductServices.getDocumentsForProduct(page_number * page_size, page_size, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getDocumentsMetaforProduct = async (req, res, next) => {
    try {
        let document = await ProductServices.getDocumentsMetaforProduct();
        ResHelper.apiResponse(res, true, "Success", 200, document, "");
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getProductRequirement = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getProductRequirement.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { page_number, page_size, product_id } = req?.body;
            if (!page_number) {
                page_number = 0
            }
            if (!page_size) {
                page_size = 10
            }
            let product = await ProductServices.getProductRequirement(page_number * page_size, page_size, product_id);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getProductMetaForRequirement = async (req, res, next) => {
    try {
        let document = await ProductServices.getProductMetaForRequirement();
        ResHelper.apiResponse(res, true, "Success", 200, document, "");
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createDocumentsForProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.createDocumentsForProduct.validate(
            req.body
        );
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            // Call the asynchronous function and use the result directly
            let product = await ProductServices.createDocumentsForProduct(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createProductForRequirement = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.createProductForRequirement.validate(
            req.body
        );
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            // Call the asynchronous function and use the result directly
            let product = await ProductServices.createProductForRequirement(req.body);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createDocumentsMetaforProduct = async (req, res, next) => {
    try {
        let product = await ProductServices.createDocumentsMetaforProduct(req.body);
        ResHelper.apiResponse(res, true, "Success", 200, product, "");
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createProductMetaForRequirement = async (req, res, next) => {
    try {
        let product = await ProductServices.createProductMetaForRequirement(
            req.body
        );
        ResHelper.apiResponse(res, true, "Success", 200, product, "");
    } catch (error) {
        logger.error(error);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteDocumentsForProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteDocumentsForProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteDocumentsForProduct(
                req.body
            );
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteDocumentsMetaForProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteDocumentsMetaForProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteDocumentsMetaForProduct(
                req.body
            );
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteProductMetaForRequirement = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteProductMetaForRequirement.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteProductMetaForRequirement(
                req.body
            );
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteRequirementsForProduct = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.deleteRequirementsForProduct.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let product = await ProductServices.deleteRequirementsForProduct(
                req.body
            );
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getProductByLoanTypeId = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getProductByLoanTypeId.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            const { platform } = req?.body;
            req.body["platform"] = platform ? platform : "b2b";
            let products = await ProductServices.getProductByLoanTypeId(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, products, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const csvToServicablePincode = async (req, res, next) => {
    try {
        let { file } = req?.body;
        const buf = Buffer.from(file, 'base64')
        const sheet = await xlsx.read(buf, { type: 'buffer' })
        await xlsx.writeFile(sheet, "uploadPayout.xlsx");
        const fileData = xlsx.readFile('uploadPayout.xlsx');
        let sheetNames = fileData.SheetNames;
        const json = xlsx.utils.sheet_to_json(fileData.Sheets[sheetNames[0]]);
        if (json.length) {
            await ProductServices.csvToServicablePincode(json)
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    }
    catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getLoanTypesPaginated = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getLoanTypesPaginated.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, category_filter, name_filter, alias_filter, status_filter, b2c_enabled_filter, b2b_enabled_filter, sort_order_filter, startDateFilter, endDateFilter } = req?.body;
            let where = "";

            if (name_filter) {
                where = checkWhereInQueryString(where);
                where += `name like '%${name_filter}%'`
            };
            if (category_filter) {
                where = checkWhereInQueryString(where);
                where += `category like '%${category_filter}%'`
            };
            if (alias_filter) {
                where = checkWhereInQueryString(where);
                where += `alias like '%${alias_filter}%'`
            };
            if (status_filter) {
                where = checkWhereInQueryString(where);
                where += ` case when status = 1 then 'Active' when status = 2 then 'UAT Active' else "Inactive" end like '%${status_filter}%' `
            };
            if (b2c_enabled_filter) {
                where = checkWhereInQueryString(where);
                where += `case when b2c_enabled = 1 then 'Yes' else 'No' end like '%${b2c_enabled_filter}%'`
            };
            if (b2b_enabled_filter) {
                where = checkWhereInQueryString(where);
                where += `case when b2b_enabled = 1 then 'Yes' else 'No' end like '%${b2b_enabled_filter}%'`
            };
            if (sort_order_filter) {
                where = checkWhereInQueryString(where);
                where += `sort_order like '%${sort_order_filter}%'`
            };
            if (startDateFilter) {
                where = checkWhereInQueryString(where);
                where += ` DATE(created_at) between DATE("${startDateFilter}") and DATE("${endDateFilter}")`
            };

            let data = await ProductServices.getLoanTypesPaginated(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    }
    catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const deleteLoanTypeById = async (req, res) => {
    try {
        const { error } = ProductValidationV1.deleteLoanTypeById.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await ProductServices.deleteLoanTypeById(req?.body?.id);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const createLoanType = async (req, res) => {
    try {
        const { error } = ProductValidationV1.createLoanType.validate(req?.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            await ProductServices.createLoanType(req?.body);
            ResHelper.apiResponse(res, true, "Success", 200, {}, "");
        }
    } catch (e) {
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    };
};

const updatePincodeCsv = async (req, res) => {
    try {
        const { error } = ProductValidationV1.updatePincodeCsv.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, _.startCase(error.message), 400, {}, "");
        } else {
            let { base64, type } = req?.body;
            base64 = await removeFormattingFromExcelBase64Async(base64);
            let data = await decodeBase64AndReadXLSXForLeadForm(base64)
            if (data[0] == -1) {
                return ResHelper.apiResponse(res, false, "Invalid File", 400, {}, "");
            };

            let active = data?.filter((obj) => obj?.status?.replace(/[\r\n\t]/g, "") == "active").map((obj) => obj?.pincode);
            let inactive = data?.filter((obj) => obj?.status?.replace(/[\r\n\t]/g, "") == "inactive").map((obj) => obj?.pincode);
            let add = data?.filter((obj) => obj?.status?.replace(/[\r\n\t]/g, "") == "add").map((obj) => obj?.pincode);

            let prevData = await ProductServices?.getPincodeHistory(data.map((obj) => obj?.pincode));

            inactive?.length && await ProductServices?.updatePincodeCsv(inactive, 0, type);
            active?.length && await ProductServices?.updatePincodeCsv(active, 1, type);
            add?.length && await ProductServices?.updatePincodeCsv(add, 2, type);

            let newData = await ProductServices?.getPincodeHistory(data.map((obj) => obj?.pincode));

            let prev = [];
            let afterUpdate = [];

            for (i = 0; i < newData?.length; i++) {
                let obj = prevData?.find((obj) => obj?.pin_code == newData[i]?.pin_code);
                prev?.push(obj ? { pin_code: obj?.pin_code, [type]: obj[type] } : {});
                afterUpdate.push({ pin_code: newData[i]?.pin_code, [type]: newData[i][type] });
            };

            createBulkLogQueue.add({ prevData: prev, newData: afterUpdate, log_type: "pincode_update", created_by: req?.loggedInUser?.id });

            return ResHelper.apiResponse(res, true, "Update in progress please refresh the page after 5 mins.", 200, {}, "");
        }
    } catch (err) {
        logger.error(err);
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};
const getProductForRm = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getProductForRm.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, product_name_filter } = req?.body;

            if (!pageNumber) {
                pageNumber = 0
            };
            if (!pageSize) {
                pageSize = 10
            };
            let where = "";
            if (product_name_filter) {
                where = checkWhereInQueryString(where);
                where += ` LOWER(rlp.product_name) LIKE '%${product_name_filter.toLowerCase()}%' `;
            };

            let product = await ProductServices.getProductForRm(pageNumber * pageSize, pageSize, where);
            ResHelper.apiResponse(res, true, "Success", 200, product, "");
        }
    } catch (e) {
        logger.error(e)
        ResHelper.apiResponse(res, false, "Error occured during execution", 500, {}, "");
    }
};

const getProductAuditLogs = async (req, res, next) => {
    try {
        const { error } = ProductValidationV1.getProductAuditLogs.validate(req.body);
        if (error) {
            ResHelper.apiResponse(res, false, error.message, 400, {}, "");
        } else {
            let { pageNumber, pageSize, product_id_filter, user_name_filter, event_type_filter, startDate, endDate } = req.body;
            if (!pageNumber) pageNumber = 0;
            if (!pageSize) pageSize = 10;

            let data = await ProductServices.getProductAuditLogs(
                pageNumber * pageSize,
                pageSize,
                { product_id_filter, user_name_filter, event_type_filter, startDate, endDate }
            );
            ResHelper.apiResponse(res, true, "Success", 200, data, "");
        }
    } catch (e) {
        console.log(e);
        logger.error(e);
        ResHelper.apiResponse(res, false, "Error occurred during execution", 500, {}, "");
    }
};

module.exports = {
    getAllProduct,
    createProduct,
    getAllLoanTypes,
    getCriteria,
    createCriteria,
    editCriteria,
    deleteCriteria,
    getContent,
    createContent,
    deleteContent,
    getServiceablePincodes,
    editServiceablePincodes,
    addServiceablePincodes,
    deleteServiceablePincode,
    getDocuments,
    getDocumentsForProduct,
    getDocumentsMetaforProduct,
    getProductRequirement,
    getProductMetaForRequirement,
    createDocumentsForProduct,
    createProductForRequirement,
    createDocumentsMetaforProduct,
    createProductMetaForRequirement,
    deleteDocumentsForProduct,
    deleteDocumentsMetaForProduct,
    deleteProductMetaForRequirement,
    deleteRequirementsForProduct,
    getProductByLoanTypeId,
    csvToServicablePincode,
    getCriteriaByProductId,
    getLoanTypesPaginated,
    deleteLoanTypeById,
    createLoanType,
    addNewLender,
    updatePincodeCsv,
    getProductForRm,
    getProductAuditLogs
};


