const PayoutError = require('./PayoutError');
const ValidationPipeline = require('../ValidationPipeline');
const { BaseValidator } = ValidationPipeline;

/**
 * Validates rate against max_expected_rate
 */
class RateValidator extends BaseValidator {
    async validate(context) {
        const { rate, max_expected_rate } = context;

        if (rate != null) {
            if (max_expected_rate == null) {
                throw new PayoutError("DSA payout capping is not configured.", 400);
            }
            if (max_expected_rate === 0) {
                throw new PayoutError("Product details are incomplete. Cannot update payout ", 400);
            }
            if (rate > max_expected_rate) {
                throw new PayoutError(`Rate limit exceeded ${max_expected_rate ? `, Max Rate limit is ${max_expected_rate}` : ""}`, 400);
            }
        }
    }
}

/**
 * Validates ratio against max_expected_ratio
 */
class RatioValidator extends BaseValidator {
    async validate(context) {
        const { ratio, max_expected_ratio } = context;

        if (ratio != null) {
            if (max_expected_ratio == null || max_expected_ratio === 0) {
                throw new PayoutError("DSA payout capping is not configured.", 400);
            }
            if (ratio > max_expected_ratio) {
                throw new PayoutError(`Ratio limit exceeded ${max_expected_ratio ? `, Max Ratio limit is ${max_expected_ratio}` : ""}`, 400);
            }
        }
    }
}

/**
 * Validates product eligibility for autonomous payouts and checks DSA settings existence
 */
class AutonomousEligibilityValidator extends BaseValidator {
    async validate(context) {
        const { is_autonomous_enabled, DSAService, bank_product_combinations_id, dsa_id } = context;

        if (!is_autonomous_enabled) {
            return;
        }

        const { is_eligible, category } = await DSAService.isProductEligibleAutonomous(bank_product_combinations_id);
        if (!is_eligible) {
            throw new PayoutError("Product is not eligible for autonomous payouts (only secured/unsecured products allowed).", 400);
        }

        const autonomousSettings = await DSAService.getDsaAutonomousSettingsByDsaId(dsa_id);
        if (!autonomousSettings) {
            throw new PayoutError("DSA autonomous settings are not configured.", 400);
        }

        // Attach to context for later validators
        context.autonomousSettings = autonomousSettings;
        context.category = category;
    }
}

/**
 * Validates disbursement dates against global autonomous settings
 */
class AutonomousDateValidator extends BaseValidator {
    async validate(context) {
        const { is_autonomous_enabled, autonomousSettings, disb_date_from, disb_date_to, category } = context;

        if (!is_autonomous_enabled) {
            return;
        }

        const { autonomous_secured_payout, autonomous_unsecured_payout, global_autonomous_disb_date_from, global_autonomous_disb_date_to } = autonomousSettings;

        const selectedCap = category === 'secured' ? autonomous_secured_payout : autonomous_unsecured_payout;
        if (!selectedCap || selectedCap <= 0 || !global_autonomous_disb_date_from) {
            throw new PayoutError(`${category} autonomous payout capping is not configured.`, 400);
        }

        if (new Date(disb_date_from) < new Date(global_autonomous_disb_date_from)) {
            throw new PayoutError(`Disbursement from date cannot be earlier than ${global_autonomous_disb_date_from}.`, 400);
        }

        if (global_autonomous_disb_date_to != null && global_autonomous_disb_date_to !== '') {
            if (disb_date_to == null || disb_date_to === '') {
                throw new PayoutError(`Disbursement to date cannot be later than ${global_autonomous_disb_date_to}.`, 400);
            }
            if (new Date(disb_date_to) > new Date(global_autonomous_disb_date_to)) {
                throw new PayoutError(`Disbursement to date cannot be later than ${global_autonomous_disb_date_to}.`, 400);
            }
        }

        // Attach selectedCap to context for next validator
        context.selectedCap = selectedCap;
    }
}

/**
 * Validates autonomous rate and ratio caps
 */
class AutonomousRateRatioValidator extends BaseValidator {
    async validate(context) {
        const { is_autonomous_enabled, autonomous_rate, autonomous_ratio, DSAService, dsa_id, bank_product_combinations_id, selectedCap } = context;

        if (!is_autonomous_enabled) {
            return;
        }

        if (autonomous_rate != null || autonomous_ratio != null) {
            const { vendor_payout_rate: max_autonomous_rate, vendor_payout_ratio: max_autonomous_ratio } = await DSAService.validateVendorPayoutNew(dsa_id, null, null, "rate", autonomous_rate, autonomous_ratio, bank_product_combinations_id, true, Number(selectedCap) || 0);

            if (autonomous_rate != null) {
                if (max_autonomous_rate == null) {
                    throw new PayoutError("Autonomous rate capping is not configured.", 400);
                }
                if (max_autonomous_rate === 0) {
                    throw new PayoutError("Product details are incomplete. Cannot set autonomous rate.", 400);
                }
                if (Number(autonomous_rate) > Number(max_autonomous_rate)) {
                    throw new PayoutError(`Autonomous rate ${autonomous_rate} exceeds maximum limit of ${max_autonomous_rate}.`, 400);
                }
            }

            if (autonomous_ratio != null) {
                if (max_autonomous_ratio == null || max_autonomous_ratio === 0) {
                    throw new PayoutError("Autonomous ratio capping is not configured.", 400);
                }
                if (Number(autonomous_ratio) > Number(max_autonomous_ratio)) {
                    throw new PayoutError(`Autonomous ratio ${autonomous_ratio} exceeds maximum limit of ${max_autonomous_ratio}.`, 400);
                }
            }
        }
    }
}

module.exports = {
    RateValidator,
    RatioValidator,
    AutonomousEligibilityValidator,
    AutonomousDateValidator,
    AutonomousRateRatioValidator
};

