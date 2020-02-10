module.exports =
  {
    "extends": ["airbnb-base", "prettier", "plugin:jest/recommended"],
    "env": {
      "es6": true,
      "node": true,
      "jest/globals": true
    },
    "plugins": ["prettier", "jest"],
    "rules": {
      "prettier/prettier": "error",
      "no-underscore-dangle": "off"
    },
    "overrides": [
      {
        "files": ["test/*.spec.js"],
        "globals": {
          "expectAsync": "readonly",
          "fetch": true,
          "window": true
        },
        "rules": {}
      }
    ]
  };
