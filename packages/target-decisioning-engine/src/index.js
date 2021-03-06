import { getLogger } from "@adobe/target-tools";
import { createDecisioningContext } from "./contextProvider";
import DecisionProvider from "./decisionProvider";
import ArtifactProvider from "./artifactProvider";
import Messages from "./messages";
import { hasRemoteDependency, matchMajorVersion } from "./utils";
import { SUPPORTED_ARTIFACT_MAJOR_VERSION } from "./constants";
import { validDeliveryRequest } from "./requestProvider";

/**
 * The TargetDecisioningEngine initialize method
 * @param {Object} config Options map, required
 * @param {String} config.client Target Client Id, required
 * @param {String} config.organizationId Target Organization Id, required
 * @param {Number} config.pollingInterval Polling interval in ms, default: 30000
 * @param {String} config.artifactLocation Fully qualified url to the location of the artifact, optional
 * @param {String} config.artifactPayload A pre-fetched artifact, optional
 * @param {Object} config.logger Replaces the default noop logger, optional
 * @param {Function }config.fetchApi Fetch Implementation, optional
 * @param {Function} config.sendNotificationFunc Function used to send notifications, optional
 */
export default async function TargetDecisioningEngine(config) {
  const logger = getLogger(config.logger);

  const artifactProvider = await ArtifactProvider({
    client: config.client,
    organizationId: config.organizationId,
    pollingInterval: config.pollingInterval,
    artifactLocation: config.artifactLocation,
    artifactPayload: config.artifactPayload,
    logger,
    fetchApi: config.fetchApi
  });

  let artifact = artifactProvider.getArtifact();

  // subscribe to new artifacts that are downloaded on the polling interval
  artifactProvider.subscribe(data => {
    artifact = data;
  });

  /**
   * The get offers method
   * @param {Object} targetOptions
   * @param {import("@adobe/target-tools/delivery-api-client/models/DeliveryRequest").DeliveryRequest} targetOptions.request Target View Delivery API request, required
   * @param {String} targetOptions.visitorCookie VisitorId cookie, optional
   * @param {String} targetOptions.targetCookie Target cookie, optional
   * @param {String} targetOptions.targetLocationHint Target Location Hint, optional
   * @param {String} targetOptions.consumerId When stitching multiple calls, different consumerIds should be provided, optional
   * @param {Array}  targetOptions.customerIds An array of Customer Ids in VisitorId-compatible format, optional
   * @param {String} targetOptions.sessionId Session Id, used for linking multiple requests, optional
   * @param {Object} targetOptions.visitor Supply an external VisitorId instance, optional
   */
  function getOffers(targetOptions) {
    const { request } = targetOptions;

    if (typeof artifact === "undefined") {
      return Promise.reject(new Error(Messages.ARTIFACT_NOT_AVAILABLE));
    }

    if (
      !matchMajorVersion(artifact.version, SUPPORTED_ARTIFACT_MAJOR_VERSION)
    ) {
      return Promise.reject(
        new Error(
          Messages.ARTIFACT_VERSION_UNSUPPORTED(
            artifact.version,
            SUPPORTED_ARTIFACT_MAJOR_VERSION
          )
        )
      );
    }

    return DecisionProvider(
      config.client,
      validDeliveryRequest(request, targetOptions.targetLocationHint),
      createDecisioningContext(request),
      artifact,
      config.sendNotificationFunc
    );
  }

  return Promise.resolve({
    getRawArtifact: () => artifact,
    stopPolling: () => artifactProvider.stopPolling(),
    getOffers: targetOptions => getOffers(targetOptions),
    hasRemoteDependency: request => hasRemoteDependency(artifact, request),
    isReady: () => typeof artifact !== "undefined"
  });
}
