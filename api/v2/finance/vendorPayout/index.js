let DSAService = require(_pathconst.ServicesPath.DSAService);
const ValidationPipeline = require('../ValidationPipeline');
const {
    RateValidator,
    RatioValidator,
    AutonomousEligibilityValidator,
    AutonomousDateValidator,
    AutonomousRateRatioValidator
} = require('./payoutValidators');
const { buildPayoutContext, handlePayoutAuditLog } = require('./payoutHelpers');

/**
 * Refactored updateDsaMasterPayout using design patterns:
 * - Custom Domain Error (PayoutError)
 * - Chain of Responsibility (Validators)
 * - Validation Pipeline
 * - Context Builder
 * - Extracted Audit Logic
 */
exports.updateDsaMasterPayout = async (req) => {
    // Build context
    const context = buildPayoutContext(req);

    // Fetch vendor caps and attach to context
    const { vendor_payout_rate: max_expected_rate, vendor_payout_ratio: max_expected_ratio } =
        await DSAService.validateVendorPayoutNew(
            context.dsa_id,
            null,
            null,
            "rate",
            context.rate,
            0,
            context.bank_product_combinations_id
        );
    context.max_expected_rate = max_expected_rate;
    context.max_expected_ratio = max_expected_ratio;

    // Run validation pipeline
    const pipeline = new ValidationPipeline()
        .use(new RateValidator())
        .use(new RatioValidator())
        .use(new AutonomousEligibilityValidator())
        .use(new AutonomousDateValidator())
        .use(new AutonomousRateRatioValidator());

    await pipeline.run(context);

    // Prepare autonomous fields
    const autonomousFields = context.is_autonomous_enabled
        ? {
            autonomous_rate: context.autonomous_rate,
            autonomous_ratio: context.autonomous_ratio,
            disb_date_from: context.disb_date_from,
            disb_date_to: context.disb_date_to,
            default_autonomous_payout_type: context.default_autonomous_payout_type
        }
        : {
            autonomous_rate: null,
            autonomous_ratio: null,
            disb_date_from: null,
            disb_date_to: null,
            default_autonomous_payout_type: null
        };
    // Fetch previous payout details for audit log
    const payout_details = await DSAService.getDsaBankProductPayoutDetils(
        context.dsa_id,
        context.bank_product_combinations_id
    );

    // Update payout
    await DSAService.updateDsaMasterPayout(
        context.bank_product_combinations_id,
        context.dsa_id,
        context.rate,
        context.ratio,
        context.payoutLock,
        context.default_payout_type,
        autonomousFields,
        context.is_autonomous_enabled
    );

    // Handle audit log
    await handlePayoutAuditLog(context, payout_details);

    return {
        success: true,
        message: "Success",
        statusCode: 200,
        data: {}
    };
};
