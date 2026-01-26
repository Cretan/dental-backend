/**
 * Deny-all policy
 * Always returns false to block the route.
 * Used to disable CRUD endpoints that should not be accessible via API.
 */
export default () => false;
