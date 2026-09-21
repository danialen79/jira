# Coverage gates

Dimensions: goal, user, acceptance, outOfScope, dependencies, risks.

| Incomplete | Required action before more questions or propose |
|------------|---------------------------------------------------|
| goal or user | `consultKnowledge` first (or via consultBrief) |
| dependencies | at least one `consultJira` |
| risks | `consultJira`; `consultWeb` only if gaps remain |
| any first turn after draft | prefer `consultBrief` (ghost interview) |
| before proposeStories | `consultJira` intent `similar` |
| writing descriptions | follow `protocols/story-description.md` (Scrum sections + AC in body) |

Mark a dimension true in `updateCoverage` only when the user (or strong evidence + user confirm) established it.
Coverage `acceptance` means the interview understood acceptance — still write معیارهای پذیرش into each Story/Bug description.
