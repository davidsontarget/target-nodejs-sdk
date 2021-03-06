import {MboxResponse} from "@adobe/target-tools/delivery-api-client";

export interface Consequence extends MboxResponse{
}

export interface Rule {
  condition: Object;
  consequence: Consequence;
  meta: {
    activityId: number;
    experienceId: number;
    type: string;
    mbox?: string;
    view?: string;
  }
}

export interface DecisioningArtifact {
    version: string;
    meta: {
      generatedAt: string;
      organizationId: string;
      workspace: number;
      environment: string;
      remoteMboxes: Array<string>;
      globalMbox: string;
    };
    rules: {
      mboxes: { [key: string]: Array<Rule>; }
      views: { [key: string]: Array<Rule>; }
    };
}
