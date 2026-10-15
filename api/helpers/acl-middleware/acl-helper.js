const {nodeAcl} = require('./acl-permissions');
let ResHelper = require(_pathconst.FilesPath.ResHelper);
let CommonHelper = require(_pathconst.FilesPath.CommonHelper);

exports.getPermissions = async (req,res,next) => {
    try{
      let role;
      if(req.loggedInUser.role ){
        role = req.loggedInUser.role
      }
      let isPermitted = false;
      const url = req.url.includes("?")?req.url.split("?")[0]:req.url;
      await nodeAcl.isAllowed(
        req.loggedInUser.id,
        url, req.method.toLowerCase(),(error, allowed) => {
          if (allowed) {
            isPermitted = true;
          }
      });
      if(isPermitted || CommonHelper.isUuid(req.loggedInUser.user_id)){
        next();
      }else{
        ResHelper.apiResponse(res, false, "You are not allowed to visit this page", 403, "", "");
      }
    }
    catch(e){
      ResHelper.apiResponse(res, false, "You are not allowed to visit this page", 403, e, "");
    }
}
