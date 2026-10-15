const DSAService = require("../../../../services/dsa-services");

/**
 * Intended for `safe()`-wrapped routes: returns `{ success, message, statusCode, data }`.
 * Request body validation is expected to be done by `reqValidator` in the route.
 *
 * Body:
 * - dsa_id (required)
 * - bank_product_combinations_id OR (bank_id + product_id) (required)
 * - for_autonomous (optional, default false)
 */
exports.getLeadPayoutDefaults = async (req) => {
    const {
        dsa_id,
        bank_id = null,
        product_id = null,
        bank_product_combinations_id = null,
        for_autonomous = false
    } = req.body || {};

    // For autonomous: validate eligibility + derive autonomous_ratio from DSA settings
    let autonomous_ratio = 0;
    let autonomousSettings = null;
    if (for_autonomous) {
        const { is_eligible, category } = await DSAService.isProductEligibleAutonomous(bank_product_combinations_id);
        if (!is_eligible) {
            return {
                success: false,
                message: "Product is not eligible for autonomous payouts",
                statusCode: 400,
                data: {}
            };
        }

        autonomousSettings = await DSAService.getDsaAutonomousSettingsByDsaId(dsa_id);
        if (!autonomousSettings) {
            return {
                success: false,
                message: "DSA autonomous settings are not configured",
                statusCode: 400,
                data: {}
            };
        }

        const { autonomous_secured_payout, autonomous_unsecured_payout } = autonomousSettings;
        autonomous_ratio =
            category === "secured" ? Number(autonomous_secured_payout) : Number(autonomous_unsecured_payout);

        if (!autonomous_ratio || autonomous_ratio <= 0) {
            return {
                success: false,
                message: `${category} autonomous payout capping is not configured`,
                statusCode: 400,
                data: {}
            };
        }
    }

    // Use validateVendorPayoutNew to compute the caps; always return the max values for autofill.
    const {
        vendor_payout_rate: max_expected_rate,
        vendor_payout_ratio: max_expected_ratio,
    } = await DSAService.validateVendorPayoutNew(
        dsa_id,
        bank_id,
        product_id,
        "rate",
        0,
        0,
        bank_product_combinations_id,
        for_autonomous,
        autonomous_ratio
    );

    const default_payout_type = Number(max_expected_rate) === 0 ? "ratio" : "rate";
    const default_autonomous_payout_type = "rate";

    const data = {
        max_expected_rate,
        max_expected_ratio,
        default_payout_type,
        ...(for_autonomous && autonomousSettings
            ? {
                  default_autonomous_payout_type,
                  global_autonomous_date_from: autonomousSettings.global_autonomous_disb_date_from,
                  global_autonomous_date_to: autonomousSettings.global_autonomous_disb_date_to
              }
            : {})
    };

    return {
        success: true,
        message: "Success",
        statusCode: 200,
        data
    };
};

