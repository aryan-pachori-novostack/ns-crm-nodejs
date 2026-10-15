const rolesTree = {
  "CEO": {
    "CUSTOMER_SUPPORT": null,
    "CTO": null,
    "CFO": null,
    "BUSINESS_HEAD": {
      "LEAD_ADMIN": null,
      "VENDOR": null,
    },
    "NEW_USER": null,
    "TECH_HEAD": null,
    "CRM_ADMIN": {
      "ACCOUNTS_HEAD": {
        "ACCOUNTS_EXECUTIVE": {
          "ROUNE_ADMIN": null,
        }
      },
      "MIS_EXECUTIVE": {
        "TELE_SUPERVISOR": {
          "TELE_CALLER": null
        },
        "HR": {
          "VERIFICATION_AGENCY": null
        },
        "DATA_MANAGER": null,
        "CRM_EXECUTIVE": {
          "REGIONAL_HEAD": {
            "HUB_HEAD": {
              "SALES_HEAD": {
                "MANAGERS": {
                  "PARTNERS": null,
                  "BACKEND": null
                },
                "SALES_EXECUTIVE": null,
              }
            }
          }
        }
      }
    }
  }
};
//find A path to Role
const findPath = (ob, key) => {
  const path = [];
  const keyExists = (obj) => {
    if (!obj || (typeof obj !== "object" && !Array.isArray(obj))) {
      return false;
    }
    else if (obj.hasOwnProperty(key)) {
      return true;
    }
    else if (Array.isArray(obj)) {
      let parentKey = path.length ? path.pop() : "";

      for (let i = 0; i < obj.length; i++) {
        path.push(`${parentKey}[${i}]`);
        const result = keyExists(obj[i], key);
        if (result) {
          return result;
        }
        path.pop();
      }
    }
    else {
      for (const k in obj) {
        path.push(k);
        const result = keyExists(obj[k], key);
        if (result) {
          return result;
        }
        path.pop();
      }
    }
    return false;
  };

  keyExists(ob);

  return path;
}

//get Parent Role
const findParent = (ob, key) => {
  const path = [];
  const keyExists = (obj) => {
    if (!obj || (typeof obj !== "object" && !Array.isArray(obj))) {
      return false;
    }
    else if (obj.hasOwnProperty(key)) {
      return true;
    }
    else if (Array.isArray(obj)) {
      let parentKey = path.length ? path.pop() : "";

      for (let i = 0; i < obj.length; i++) {
        path.push(`${parentKey}[${i}]`);
        const result = keyExists(obj[i], key);
        if (result) {
          return path[path.length - 1] ? path[path.length - 1] : null;
        }
        path.pop();
      }
    }
    else {
      for (const k in obj) {
        path.push(k);
        const result = keyExists(obj[k], key);
        if (result) {
          return path[path.length - 1] ? path[path.length - 1] : null;
        }
        path.pop();
      }
    }
    return false;
  };

  keyExists(ob);

  return path[path.length - 1] ? path[path.length - 1] : null;
}
// get Child object for that node
const getChildObjectForKey = (obj, key) => {
  let parents = findPath(rolesTree, key);
  parents.push(key);
  for (let i = 0; i < parents.length; i++) {
    obj = obj[parents[i]];
  }
  return obj;
}
// get All Child Nodes 
const getAllChildNodes = (ob, key) => {
  ob = getChildObjectForKey(ob, key);
  const path = [];
  const keyExists = (obj) => {
    if (Array.isArray(obj)) {
      let parentKey = path.length ? path.pop() : "";

      for (let i = 0; i < obj.length; i++) {
        path.push(`${parentKey}[${i}]`);
        const result = keyExists(obj[i], key);
        if (result) {
          return path;
        }
        // path.pop();
      }
    }
    else {
      for (const k in obj) {
        path.push(k);
        const result = keyExists(obj[k], key);
        if (result) {
          return path;
        }
        // path.pop();
      }
    }
    return false;
  };

  keyExists(ob);

  return path;
}

module.exports = {
  rolesTree,
  getAllChildNodes,
  findParent
}