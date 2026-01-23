// src/policies/index.ts
import manageOwnCabinet from "./manage-own-cabinet";
import canUpdateOwnCabinet from "./can-update-own-cabinet-users";
import cabinetIsolation from "./cabinet-isolation";

export default {
  "manage-own-cabinet": manageOwnCabinet,
  "can-update-own-cabinet-users": canUpdateOwnCabinet,
  "cabinet-isolation": cabinetIsolation,
};
