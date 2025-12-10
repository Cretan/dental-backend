/**
 * Vizita Lifecycle Hooks
 * Auto-populates added_by field with authenticated user
 * Production-ready implementation using JWT token from request context
 */

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    const user = event.state?.user;

    // Auto-populate added_by with authenticated user
    if (user && user.id) {
      data.added_by = user.id;
    } else {
      strapi.log.warn('Visit created without authenticated user - added_by not set');
    }

    // Auto-populate status_vizita if not provided
    if (!data.status_vizita) {
      data.status_vizita = 'Programata';
    }
  },

  async beforeUpdate(event) {
    // added_by should not be changed after creation
    const { data } = event.params;
    if (data.added_by !== undefined) {
      delete data.added_by;
      strapi.log.warn('Attempt to modify added_by field blocked');
    }
  },
};
