import type { Connector, Source } from "../types.js";
import { gmailConnector } from "./gmailConnector.js";
import { notionConnector } from "./notionConnector.js";
import { linearConnector } from "./linearConnector.js";
import { calendarConnector } from "./calendarConnector.js";

export const connectors: Record<Source, Connector> = {
  email: gmailConnector,
  notion: notionConnector,
  linear: linearConnector,
  calendar: calendarConnector,
};
