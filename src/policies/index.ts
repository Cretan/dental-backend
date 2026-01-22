// src/policies/index.ts
import manageOwnCabinet from "./manage-own-cabinet";
import canUpdateOwnCabinet from "./can-update-own-cabinet-users";

export default {
  "manage-own-cabinet": manageOwnCabinet,
  "can-update-own-cabinet-users": canUpdateOwnCabinet,
};
