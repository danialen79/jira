import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseJiraSprintField,
  pickCurrentSprint,
  type ParsedSprint,
} from "./jira-sprint.ts";

const SIP_2282_BLOB =
  "com.atlassian.greenhopper.service.sprint.Sprint@693f1f87[activatedDate=<null>,autoStartStop=false,completeDate=<null>,endDate=<null>,goal=<null>,id=67,incompleteIssuesDestinationId=<null>,name=SIP Sprint 18,rapidViewId=79,sequence=67,startDate=<null>,state=FUTURE,synced=false]";

const CLOSED_BLOB =
  "com.atlassian.greenhopper.service.sprint.Sprint@abc[id=66,name=SIP Sprint 17,state=CLOSED]";

const ACTIVE_BLOB =
  "com.atlassian.greenhopper.service.sprint.Sprint@def[id=68,name=SIP Sprint 19,state=ACTIVE]";

describe("parseJiraSprintField", () => {
  it("parses Server/DC string[] (SIP-2282 shape)", () => {
    assert.deepEqual(parseJiraSprintField([SIP_2282_BLOB]), {
      selectedSprint: "67",
      sprintName: "SIP Sprint 18",
    });
  });

  it("parses a single toString blob", () => {
    assert.deepEqual(parseJiraSprintField(SIP_2282_BLOB), {
      selectedSprint: "67",
      sprintName: "SIP Sprint 18",
    });
  });

  it("prefers ACTIVE over later FUTURE/CLOSED in history", () => {
    assert.deepEqual(
      parseJiraSprintField([CLOSED_BLOB, ACTIVE_BLOB, SIP_2282_BLOB]),
      {
        selectedSprint: "68",
        sprintName: "SIP Sprint 19",
      }
    );
  });

  it("falls back to last entry when none active", () => {
    assert.deepEqual(parseJiraSprintField([CLOSED_BLOB, SIP_2282_BLOB]), {
      selectedSprint: "67",
      sprintName: "SIP Sprint 18",
    });
  });

  it("parses object and object[]", () => {
    assert.deepEqual(
      parseJiraSprintField({ id: 10, name: "S1", state: "future" }),
      { selectedSprint: "10", sprintName: "S1" }
    );
    assert.deepEqual(
      parseJiraSprintField([
        { id: 1, name: "Old", state: "closed" },
        { id: 2, name: "Now", state: "active" },
      ]),
      { selectedSprint: "2", sprintName: "Now" }
    );
  });

  it("handles numeric id and empty", () => {
    assert.deepEqual(parseJiraSprintField(42), { selectedSprint: "42" });
    assert.deepEqual(parseJiraSprintField(null), {});
    assert.deepEqual(parseJiraSprintField([]), {});
  });
});

describe("pickCurrentSprint", () => {
  it("is case-insensitive for active", () => {
    const entries: ParsedSprint[] = [
      { id: "1", name: "A", state: "closed" },
      { id: "2", name: "B", state: "Active" },
    ];
    assert.equal(pickCurrentSprint(entries)?.id, "2");
  });
});
