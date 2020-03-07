/* eslint-disable import/prefer-default-export */
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

import { Messages } from "./messages";
import {
  getDeviceId,
  getCluster,
  getSessionId,
  getTargetHost,
  createHeaders,
  createDeliveryRequest,
  createConfiguration,
  createDeliveryApi,
  processResponse
} from "./helper";
import { parseCookies } from "./cookies";

export function executeDelivery(options, decisioningEngine) {
  const {
    visitor,
    config,
    logger,
    targetLocationHintCookie,
    targetCookie,
    consumerId,
    request,
    useBeacon,
    createDeliveryApiMethod = createDeliveryApi
  } = options;

  const { serverDomain, client, timeout, secure, environmentId } = config;

  const cookies = parseCookies(targetCookie);
  const deviceId = getDeviceId(cookies);
  const cluster = getCluster(deviceId, targetLocationHintCookie);
  const host = getTargetHost(serverDomain, cluster, client, secure);
  const sessionId = getSessionId(cookies, options.sessionId);
  const headers = createHeaders();

  const requestOptions = {
    logger,
    visitor,
    deviceId,
    consumerId,
    environmentId
  };

  const deliveryRequest = createDeliveryRequest(request, requestOptions);

  logger.debug(Messages.REQUEST_SENT, JSON.stringify(deliveryRequest, null, 2));

  const configuration = createConfiguration(
    config.fetchApi,
    host,
    headers,
    timeout
  );

  return createDeliveryApiMethod(
    configuration,
    useBeacon,
    options.config.executionMode,
    decisioningEngine
  )
    .execute(client, sessionId, deliveryRequest, config.version)
    .then((response = {}) => {
      logger.debug(
        Messages.RESPONSE_RECEIVED,
        JSON.stringify(response, null, 2)
      );
      return Object.assign(
        { visitorState: visitor.getState(), request: deliveryRequest },
        processResponse(sessionId, cluster, response)
      );
    });
}
