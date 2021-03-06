/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import { getFetchApi, getLogger } from "@adobe/target-tools";
import Visitor from "@adobe-mcid/visitor-js-server";
import TargetDecisioningEngine from "@adobe/target-decisioning-engine";
import { createVisitor, requiresDecisioningEngine } from "./utils";
import { Messages } from "./messages";
import { EXECUTION_MODE } from "./enums";
import { LOCATION_HINT_COOKIE, TARGET_COOKIE } from "./cookies";
import { executeDelivery } from "./target";
import { AttributesProvider } from "./attributesProvider";
import {
  addMboxesToRequest,
  EMPTY_REQUEST,
  preserveLocationHint,
  requestLocationHintCookie
} from "./helper";

import {
  validateClientOptions,
  validateGetOffersOptions,
  validateSendNotificationsOptions
} from "./validators";

const AMCV_PREFIX = "AMCV_";
const DEFAULT_TIMEOUT = 3000;

function emitClientReady(config) {
  if (typeof config.clientReadyCallback === "function") {
    config.clientReadyCallback();
  }
}

export default function bootstrap(fetchApi) {
  const fetchImpl = getFetchApi(fetchApi);

  if (!fetchImpl) {
    throw new Error(Messages.FETCH_UNDEFINED);
  }

  class TargetClient {
    constructor(options) {
      if (!options || !options.internal) {
        throw new Error(Messages.PRIVATE_CONSTRUCTOR);
      }
      this.config = options;
      this.config.timeout = options.timeout || DEFAULT_TIMEOUT;
      this.logger = getLogger(options.logger);

      if (requiresDecisioningEngine(options.executionMode)) {
        Promise.all([
          requestLocationHintCookie(this, this.config.targetLocationHint),
          TargetDecisioningEngine({
            client: options.client,
            organizationId: options.organizationId,
            pollingInterval: options.pollingInterval,
            artifactLocation: options.artifactLocation,
            artifactPayload: options.artifactPayload,
            logger: this.logger,
            fetchApi: fetchImpl,
            sendNotificationFunc: notificationOptions =>
              this.sendNotifications(notificationOptions)
          })
        ])
          // eslint-disable-next-line no-unused-vars
          .then(([locationHintResponse, decisioningEngine]) => {
            this.decisioningEngine = decisioningEngine;
            emitClientReady(options);
          });
      } else {
        setTimeout(() => emitClientReady(options), 100);
      }
    }

    /**
     * The TargetClient creation factory method
     * @param {Object} options Options map, required
     * @param {Function }options.fetchApi Fetch Implementation, optional
     * @param {String} options.client Target Client Id, required
     * @param {String} options.organizationId Target Organization Id, required
     * @param {Number} options.timeout Target request timeout in ms, default: 3000
     * @param {String} options.serverDomain Server domain, optional
     * @param {String} options.targetLocationHint Target Location Hint, optional
     * @param {boolean} options.secure Unset to enforce HTTP scheme, default: true
     * @param {Object} options.logger Replaces the default noop logger, optional
     * @param {('local'|'remote'|'hybrid')} options.executionMode The execution mode, defaults to remote, optional
     * @param {Number} options.pollingInterval (Local Decisioning) Polling interval in ms, default: 30000
     * @param {String} options.artifactLocation (Local Decisioning) Fully qualified url to the location of the artifact, optional
     * @param {String} options.artifactPayload (Local Decisioning) A pre-fetched artifact, optional
     * @param {Number} options.environmentId The environment ID, defaults to prod, optional
     * @param {String} options.version The version number of at.js, optional
     * @param {String} options.clientReadyCallback A callback that is called when the TargetClient is ready, optional
     */
    static create(options) {
      const error = validateClientOptions(options);

      if (error) {
        throw new Error(error);
      }

      return new TargetClient(
        Object.assign(
          {
            internal: true,
            executionMode: EXECUTION_MODE.REMOTE,
            fetchApi: fetchImpl
          },
          options
        )
      );
    }

    /**
     * The TargetClient getOffers method
     * @param {Object} options
     * @param {import("@adobe/target-tools/delivery-api-client/models/DeliveryRequest").DeliveryRequest} options.request Target View Delivery API request, required
     * @param {String} options.visitorCookie VisitorId cookie, optional
     * @param {String} options.targetCookie Target cookie, optional
     * @param {String} options.targetLocationHint Target Location Hint, optional
     * @param {String} options.consumerId When stitching multiple calls, different consumerIds should be provided, optional
     * @param {Array}  options.customerIds An array of Customer Ids in VisitorId-compatible format, optional
     * @param {String} options.sessionId Session Id, used for linking multiple requests, optional
     * @param {Object} options.visitor Supply an external VisitorId instance, optional
     * @param {('local'|'remote'|'hybrid')} options.executionMode The execution mode, defaults to remote, optional
     */
    getOffers(options) {
      const error = validateGetOffersOptions(options);

      if (error) {
        return Promise.reject(new Error(error));
      }

      const visitor = createVisitor(options, this.config);

      const targetOptions = Object.assign(
        {
          visitor,
          config: {
            ...this.config,
            executionMode: options.executionMode || this.config.executionMode
          },
          logger: this.logger
        },
        options
      );

      return executeDelivery(targetOptions, this.decisioningEngine).then(
        preserveLocationHint.bind(this)
      );
    }

    /**
     * The TargetClient getAttributes method
     * @param {Array<String>} mboxNames A list of mbox names that contains JSON content attributes, required
     * @param {Object} options, required
     * @param {import("@adobe/target-tools/delivery-api-client/models/DeliveryRequest").DeliveryRequest} options.request Target View Delivery API request, required
     * @param {String} options.visitorCookie VisitorId cookie, optional
     * @param {String} options.targetCookie Target cookie, optional
     * @param {String} options.targetLocationHint Target Location Hint, optional
     * @param {String} options.consumerId When stitching multiple calls, different consumerIds should be provided, optional
     * @param {Array}  options.customerIds An array of Customer Ids in VisitorId-compatible format, optional
     * @param {String} options.sessionId Session Id, used for linking multiple requests, optional
     * @param {Object} options.visitor Supply an external VisitorId instance, optional
     */
    getAttributes(mboxNames, options = {}) {
      // eslint-disable-next-line no-param-reassign
      options.request = options.request || EMPTY_REQUEST;

      return this.getOffers({
        ...options,
        request: addMboxesToRequest(mboxNames, options.request, "execute")
      }).then(res => AttributesProvider(mboxNames, res));
    }

    /**
     * The TargetClient sendNotifications method
     * @param {Object} options
     * @param {import("@adobe/target-tools/delivery-api-client/models/DeliveryRequest").DeliveryRequest} options.request Target View Delivery API request, required
     * @param {String} options.visitorCookie VisitorId cookie, optional
     * @param {String} options.targetCookie Target cookie, optional
     * @param {String} options.targetLocationHint Target Location Hint, optional
     * @param {String} options.consumerId When stitching multiple calls, different consumerIds should be provided, optional
     * @param {Array}  options.customerIds An array of Customer Ids in VisitorId-compatible format, optional
     * @param {String} options.sessionId Session Id, used for linking multiple requests, optional
     * @param {Object} options.visitor Supply an external VisitorId instance, optional
     */

    sendNotifications(options) {
      const error = validateSendNotificationsOptions(options);

      if (error) {
        return Promise.reject(new Error(error));
      }

      const visitor = createVisitor(options, this.config);

      const targetOptions = {
        visitor,
        config: {
          ...this.config,
          executionMode: EXECUTION_MODE.REMOTE // execution mode for sending notifications must always be remote
        },
        logger: this.logger,
        useBeacon: true,
        ...options
      };

      return executeDelivery(targetOptions).then(
        preserveLocationHint.bind(this)
      );
    }

    static getVisitorCookieName(orgId) {
      return AMCV_PREFIX + orgId;
    }

    static get TargetCookieName() {
      return TARGET_COOKIE;
    }

    static get TargetLocationHintCookieName() {
      return LOCATION_HINT_COOKIE;
    }

    static get AuthState() {
      return Visitor.AuthState;
    }
  }

  return TargetClient;
}
