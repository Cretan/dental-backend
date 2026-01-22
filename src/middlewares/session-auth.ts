/**
 * PRODUCTION Cabinet Isolation Middleware
 * Ensures users see only their own cabinet data (published content only)
 */
export default (config: any, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<any>) => {
    
    // Skip admin and auth routes
    if (ctx.url.startsWith('/admin') || ctx.url.startsWith('/api/auth')) {
      await next();
      return;
    }
    
    // Only for API routes
    if (!ctx.url.startsWith('/api/')) {
      await next();
      return;
    }
    
    // Check authentication token
    const authHeader = ctx.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      await next();
      return;
    }
    
    try {
      const token = authHeader.substring(7);
      
      // Verify JWT token
      const decoded = await strapi.plugins["users-permissions"].services.jwt.verify(token);
      
      // Get user with cabinet relations
      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: decoded.id },
        populate: ['role', 'cabinet', 'cabinet_angajat']
      });
      
      if (!user) {
        console.log('❌ User not found');
        ctx.status = 401;
        ctx.body = { error: "User not found" };
        return;
      }
      
      console.log(`👤 User: ${user.email}`);
      console.log(`🔗 user.cabinet: ${user.cabinet ? user.cabinet.nume_cabinet + ' (ID:' + user.cabinet.id + ', published: ' + !!user.cabinet.publishedAt + ')' : 'none'}`);
      console.log(`🔗 user.cabinet_angajat: ${user.cabinet_angajat ? 'yes' : 'none'}`);
      
      // Smart cabinet detection: Handle Strapi draft/publish system
      let primaryCabinetId = null;
      
      if (user.cabinet && user.cabinet.id) {
        if (user.cabinet.publishedAt) {
          // User has direct link to published cabinet
          primaryCabinetId = user.cabinet.id;
          console.log(`✅ OWNER of published cabinet ${primaryCabinetId}`);
        } else {
          // User has link to draft - find published version by name
          console.log(`🔍 User linked to DRAFT cabinet "${user.cabinet.nume_cabinet}" - searching for published version...`);
          const publishedCabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
            where: { 
              nume_cabinet: user.cabinet.nume_cabinet,
              publishedAt: { $ne: null }
            }
          });
          
          if (publishedCabinet) {
            primaryCabinetId = publishedCabinet.id;
            console.log(`✅ Found PUBLISHED version: ${primaryCabinetId} (${publishedCabinet.nume_cabinet})`);
          } else {
            console.log(`⚠️ No published version found for cabinet "${user.cabinet.nume_cabinet}"`);
          }
        }
      } else if (user.cabinet_angajat) {
        // Handle employee cabinet relations with draft/publish logic
        let employeeCabinet = null;
        if (Array.isArray(user.cabinet_angajat) && user.cabinet_angajat.length > 0) {
          employeeCabinet = user.cabinet_angajat[0];
        } else if (user.cabinet_angajat.id) {
          employeeCabinet = user.cabinet_angajat;
        }
        
        if (employeeCabinet) {
          if (employeeCabinet.publishedAt) {
            primaryCabinetId = employeeCabinet.id;
            console.log(`✅ EMPLOYEE of published cabinet ${primaryCabinetId}`);
          } else {
            // Find published version of employee cabinet
            console.log(`🔍 Employee linked to DRAFT cabinet - searching for published version...`);
            const publishedCabinet = await strapi.db.query('api::cabinet.cabinet').findOne({
              where: { 
                nume_cabinet: employeeCabinet.nume_cabinet,
                publishedAt: { $ne: null }
              }
            });
            
            if (publishedCabinet) {
              primaryCabinetId = publishedCabinet.id;
              console.log(`✅ Found published version for employee: ${primaryCabinetId}`);
            } else {
              console.log(`⚠️ No published version found for employee cabinet`);
            }
          }
        }
      }
      
      if (!primaryCabinetId) {
        console.log('⚠️  No cabinet found for user!');
      }
      
      // Enhance user context
      ctx.state.user = {
        ...user,
        primaryCabinetId
      };
      
      // Apply cabinet filtering for list requests (published content only)
      if (primaryCabinetId && ctx.method === "GET" && !ctx.params?.id && user.role?.type !== "Super Admin") {
        console.log('🎯 APPLYING CABINET FILTERING...');
        ctx.query = ctx.query || {};
        ctx.query.filters = ctx.query.filters || {};
        
        if (ctx.url.includes('/cabinets')) {
          // Show only user's cabinet
          ctx.query.filters.id = { $eq: primaryCabinetId };
          console.log(`📋 Cabinet filter applied: id=${primaryCabinetId}`);
        } else if (ctx.url.includes('/pacients') || ctx.url.includes('/vizitas') || 
                   ctx.url.includes('/plan-trataments') || ctx.url.includes('/price-lists')) {
          // Filter by cabinet relation
          ctx.query.filters.cabinet = ctx.query.filters.cabinet || {};
          ctx.query.filters.cabinet.id = { $eq: primaryCabinetId };
          console.log(`📋 Relation filter applied: cabinet.id=${primaryCabinetId}`);
        }
        
        console.log(`🔍 Final query filters:`, JSON.stringify(ctx.query.filters));
      }
      
      console.log('➡️  Proceeding to next...');
      await next();
      console.log('✅ Middleware completed');
      
    } catch (error) {
      // Log error in production but continue
      console.error('💥 Cabinet isolation middleware error:', error.message);
      await next();
    }
  };
};