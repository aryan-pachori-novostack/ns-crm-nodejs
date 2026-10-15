let Joi = require("joi");

const signUpCEO = Joi.object({
  email: Joi.string()
    .email()
    .required(),
  password: Joi.string()
    .required()
    .min(2)
    .max(50),
  name: Joi.string().required(),
  phone: Joi.string().required().length(10).pattern(/^[0-9]+$/),
});

const loginCEO = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(2).max(50),
});

const loginCEOVerifyOtp = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required().min(2).max(50),
  otp: Joi.string().required().min(6).max(6),
  rememberDevice: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false", "1", "0")).optional(),
});

const addUser = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .pattern(/^[a-zA-Z0-9._%+-]+@(ruloans\.com|ext\.ruloans\.com|novostack\.com)$/)
    .required()
    .messages({
      'string.pattern.base': 'Email must be from ruloans.com domain.',
      'string.email': 'Please enter a valid email address.',
      'any.required': 'Email is required.'
    }),
  password: Joi.string()
    .required()
    .min(2)
    .max(50),
  name: Joi.string().required(),
  parent: Joi.string(),
  phone: Joi.string().required().length(10).pattern(/^[0-9]+$/),
  role: Joi.string().required(),
  dsa_id: Joi.string().allow(null, ""),
  business_head: Joi.array().allow(null, ""),
});

const updateUser = Joi.object({
  user_id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  parent: Joi.string().allow("", null),
  phone: Joi.string().required().length(10).pattern(/^[0-9]+$/),
  role: Joi.string().required(),
  business_head: Joi.array().allow(null, ""),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .pattern(/^[a-zA-Z0-9._%+-]+@(ruloans\.com|ext\.ruloans\.com|novostack\.com)$/)
    .required()
    .messages({
      'string.pattern.base': 'Email must be from ruloans.com domain.',
      'string.email': 'Please enter a valid email address.',
      'any.required': 'Email is required.'
    }),

});

const validateOtp = Joi.object({
  otp: Joi.number().required(),
});

const changePassword = Joi.object({
  password: Joi.string()
    .required()
    .min(2)
    .max(50),
  confirmPassword: Joi.string()
    .required()
    .min(2)
    .max(50),
});

const getAllUsers = Joi.object({
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  search: Joi.string().allow(null, ''),
  startDateFilter: Joi.string().allow(null, ''),
  endDateFilter: Joi.string().allow(null, ''),
  userName: Joi.string().allow(null, ''),
  userEmail: Joi.string().allow(null, ''),
  parent: Joi.string().allow(null, ''),
  role: Joi.string().allow(null, ''),
  userPhone: Joi.string().allow(null, ''),
  status: Joi.string().allow(null, ''),
  bank: Joi.number().allow(null, ''),
  payout: Joi.number().allow(null, ''),
  phone: Joi.string().allow(null, ''),
  isDeleted: Joi.number().allow(null, ''),
  id: Joi.string().allow(null, ''),
  is_export: Joi.boolean().allow(null, ""),
});

const getAllRmUsers = Joi.object({
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  search: Joi.string().allow(null, ''),
  startDateFilter: Joi.string().allow(null, ''),
  endDateFilter: Joi.string().allow(null, ''),
  city_filter: Joi.string().allow(null, ''),
  branch_name_filter: Joi.string().allow(null, ''),
  sp_id_filter: Joi.string().allow(null, ''),
  sp_name_filter: Joi.string().allow(null, ''),
  code_filter: Joi.string().allow(null, ''),
  sp_email_filter: Joi.string().allow(null, ''),
  sp_mobile_filter: Joi.string().allow(null, ''),
  reference_id_filter: Joi.string().allow(null, ''),
  location_tag_filter: Joi.string().allow(null, ''),
  is_active_filter: Joi.optional().allow(null, ''),
  product_id_filter: Joi.string().allow(null, ''),
  product_name_filter: Joi.string().allow(null, ''),
  created_by_filter: Joi.string().allow(null, ''),
  updated_by_filter: Joi.string().allow(null, ''),
  startDateFilter: Joi.string().allow(null, ''),
  endDateFilter: Joi.string().allow(null, ''),
  approved_status: Joi.number().allow(null, ''),
  pincode_filter: Joi.string().allow(null, '')
});

const getProductDropdown = Joi.object({
  type: Joi.string().valid('product_id', 'all').required()
});

const getRmUserByPhone = Joi.object({
  sp_mobile: Joi.string().allow(null, ""),
  sp_email: Joi.string().allow(null, ""),
});

const getRmUserByEmail = Joi.object({
  // Only sp_email is accepted in payload/query for this API.
  // Empty value is allowed for initial dropdown load.
  sp_email: Joi.string().trim().allow("").required(),
  // Pagination params are added now for future scalability.
  pageNumber: Joi.number().integer().min(0).default(0),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
});

const createRmUser = Joi.object({
  id: Joi.number().allow(null, ""),
  city: Joi.string().optional().allow(null, ''),
  branch_name: Joi.string().allow(null, ''),
  sp_id: Joi.string().allow(null, ''),
  sp_name: Joi.string().allow(null, ''),
  product_id: Joi.number().required(),
  status: Joi.number().valid(0, 1).optional(),
  code: Joi.string()
  .optional()
  .allow(null, '')
    .pattern(/^[a-zA-Z0-9_@]+$/)
    .when('product_id', {
      is: 67,
      then: Joi.optional().allow(null, ''),
      otherwise: Joi.required()
    }),
  sp_email: Joi.string().allow(null, ''),
  sp_mobile: Joi.string().allow(null, ''),
  reference_id: Joi.string().allow(null, ''),
  location_tag: Joi.string().allow(null, ''),
  is_active: Joi.number().allow(null, ''),
  is_approved: Joi.number().allow(null, ''),
  pincode: Joi.number().integer().min(100000).max(999999).optional().allow(null, '')
});

const deleteRmUser = Joi.object({
  id: Joi.number().required() // Assuming `id` is required to delete the user
  // data: Joi.object({
  //   id: Joi.number().required()
  // }).required()
});

const deleteUser = Joi.object({
  email: Joi.string().email().required(),
  isDeleted: Joi.boolean().required(),
});

const enableUser = Joi.object({
  email: Joi.string().email().required()
});

const getParentRole = Joi.object({
  role: Joi.string().required()
});

const getUserByRole = Joi.object({
  role: Joi.string().required().allow('', null, 'CEO', 'CRM_ADMIN', 'ACCOUNTS_HEAD', 'ACCOUNTS_EXECUTIVE', 'ROUNE_ADMIN', 'TELE_SUPERVISOR', 'TELE_CALLER', 'HR', 'VERIFICATION_AGENCY', 'MIS_EXECUTIVE', 'CRM_EXECUTIVE', 'REGIONAL_HEAD', 'BUSINESS_HEAD', 'HUB_HEAD', 'SALES_HEAD', 'MANAGERS', 'PARTNERS', 'BACKEND'),
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  search: Joi.string().allow(null, ""),
  user_filter: Joi.string().allow(null, ""),
  backend_access: Joi.boolean().allow(null, ""),
});

const getUserByBusinessHead = Joi.object({
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  search: Joi.string().allow(null, ""),
  role: Joi.string().allow(null, ""),
});

const getUserById = Joi.object({
  id: Joi.string().required()
});

const getUserTrustedDevices = Joi.object({
  user_id: Joi.string().uuid().required()
});

const revokeTrustedDevice = Joi.object({
  device_id: Joi.number().integer().optional()
});

const resetPassword = Joi.object({
  otp: Joi.number().required(),
  password: Joi.string().required(),
  confirmPassword: Joi.string().required(),
  email: Joi.string().required()
});

const resetPasswordLink = Joi.object({
  email: Joi.string().required()
});

const verifyResetPasswordLink = Joi.object({
  user_id: Joi.string().required(),
  token: Joi.string().required()
})

const updateStatus = Joi.object({
  user_id: Joi.string().required(),
  status_id: Joi.number().required()
});

const changePasswordByAdmin = Joi.object({
  user_id: Joi.string().required(),
  password: Joi.string()
    .required()
    .min(2)
    .max(50),
  oldPassword: Joi.string().allow(null, ""),
  isNormalUser: Joi.boolean().required(),
});

const changePasswordNew = Joi.object({
  new_password: Joi.string().required()
})
const updatePayoutStatus = Joi.object({
  user_id: Joi.string().required(),
  status: Joi.boolean().required()
})
const updateBankStatus = Joi.object({
  user_id: Joi.string().required(),
  status: Joi.boolean().required()
})
const updateBackendAccessStatus = Joi.object({
  user_id: Joi.string().required(),
  status: Joi.boolean().required()
})

const updateBankFilePayoutAccessStatus = Joi.object({
  user_id: Joi.string().required(),
  status: Joi.boolean().required()
})

const addCallerId = Joi.object({
  user_id: Joi.string().required(),
  caller_id: Joi.string().required()
})
const updateCallerId = Joi.object({
  user_id: Joi.string().required(),
  caller_id: Joi.string().required(),
  has_calling_enabled: Joi.boolean().required()
})

const getCallerId = Joi.object({
  user_id: Joi.string().required()
})

const clickToCall = Joi.object({
  reciever_mobile: Joi.string().required().length(10).pattern(/^[0-9]+$/)
})

const getAllCallerId = Joi.object({
  mobile: Joi.string().required().pattern(/^[0-9]+$/).allow(null, ''),
  pageNumber: Joi.number(),
  pageSize: Joi.number()
});

const getUserActivityLogs = Joi.object({
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  api_type: Joi.string().required(),
  name_filter: Joi.string().allow(null, ""),
  email_filter: Joi.string().allow(null, ""),
  api_filter: Joi.string().allow(null, ""),
  ip_filter: Joi.string().allow(null, ""),
  startDateFilter: Joi.string().allow(null, ""),
  endDateFilter: Joi.string().allow(null, ""),
});

const getAllBlacklistedUsers = Joi.object({
  pageNumber: Joi.number(),
  pageSize: Joi.number(),
  user_email_filter: Joi.string().allow(null, ""),
  user_phone_filter: Joi.string().allow(null, ""),
  blacklisted_by_filter: Joi.string().allow(null, ""),
  comment_filter: Joi.string().allow(null, "")
});

const insertBlacklistedUser = Joi.object({
  user_email: Joi.string().required(),
  user_phone: Joi.string().required(),
  comment: Joi.string().allow(null, "")
});

const deleteBlacklistedUser = Joi.object({
  id: Joi.number().required()
});

const sendSocketNotificationCRM = Joi.object({
  email: Joi.string().required(),
  topic: Joi.string().required(),
  title: Joi.string().required(),
  body: Joi.string().required(),
  image: Joi.string().allow(null).optional(),
  link: Joi.string().allow(null).optional(),
  ref_id: Joi.string().allow(null, "")
});

const bulkApproveRMUser = Joi.object({
  user: Joi.array().required()
});
const markasReadNotification = Joi.object({
  id: Joi.string().required()
});

const getUserPushNotificationLogs = Joi.object({
  page: Joi.number().optional(),
  pageSize: Joi.number().optional(),
});

const getUserPushNotificationLogsReaded = Joi.object({
  page: Joi.number().optional(),
  pageSize: Joi.number().optional(),
});

const sendOTPToEmail = Joi.object({
  email: Joi.string().email().required(),
  type: Joi.string().required(),
  reset: Joi.boolean().allow(null, ""),
  send_to_me: Joi.string().allow(null, "")
});

const reactivateUser = Joi.object({
    user_id: Joi.string().required(),
});

const getTelecallerDailyCapacity = Joi.object({
  telecaller_id: Joi.string().required(),
  allocation_date: Joi.string().allow(null, ''),
});

const getTelecallerDailyCapacityHistory = Joi.object({
  telecaller_id: Joi.string().trim().required(),
  startDateFilter: Joi.string().allow(null, ''),
  endDateFilter: Joi.string().allow(null, ''),
  pageNumber: Joi.number().default(0),
  pageSize: Joi.number().default(10),
});

const updateTelecallerDailyCapacity = Joi.object({
  id: Joi.number().required(),
  max_capacity: Joi.number().integer().min(0).required(),
});

const getSampleTemplateData = Joi.object({
  key: Joi.string().required()
});

module.exports = {
  getUserPushNotificationLogs,
  getUserPushNotificationLogsReaded,
  signUpCEO,
  loginCEO,
  loginCEOVerifyOtp,
  addUser,
  validateOtp,
  changePassword,
  getAllUsers,
  getAllRmUsers,
  createRmUser,
  deleteRmUser,
  getProductDropdown,
  deleteUser,
  enableUser,
  updateUser,
  getParentRole,
  getUserByRole,
  getUserById,
  getUserTrustedDevices,
  revokeTrustedDevice,
  resetPassword,
  resetPasswordLink,
  verifyResetPasswordLink,
  changePasswordByAdmin,
  updateStatus,
  changePasswordNew,
  updatePayoutStatus,
  updateBankStatus,
  updateBackendAccessStatus,
  addCallerId,
  updateCallerId,
  getCallerId,
  clickToCall,
  getAllCallerId,
  getUserActivityLogs,
  getUserByBusinessHead,
  updateBankFilePayoutAccessStatus,
  getAllBlacklistedUsers,
  insertBlacklistedUser,
  deleteBlacklistedUser,
  sendSocketNotificationCRM,
  bulkApproveRMUser,
  getRmUserByPhone,
  getRmUserByEmail,
  markasReadNotification,
  sendOTPToEmail,
  reactivateUser,
  getTelecallerDailyCapacity,
  getTelecallerDailyCapacityHistory,
  updateTelecallerDailyCapacity,
  getSampleTemplateData
};