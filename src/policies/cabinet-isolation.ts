/**
 * Cabinet Isolation Policy for Strapi v5
 * 
 * Works in conjunction with enhanced middleware to ensure cabinet isolation.
 * TypeScript version with proper type definitions.
 */

interface User {
  id: number;
  role?: {
    type: string;
    name: string;
  };
  primaryCabinetId?: number;
}

interface RouteInfo {
  apiName?: string;
}

interface Route {
  info?: RouteInfo;
}

interface RequestBody {
  data?: {
    cabinet?: number | { id: number };
    [key: string]: any;
  };
}

export default async (
  ctx: any,
  config: any,
  { strapi }: { strapi: any }
): Promise<boolean> => {
  const user: User = ctx.state.user;
  const { method } = ctx.request;
  const { id } = ctx.params;

  // Read primaryCabinetId from ctx.state (set by session-auth middleware)
  const primaryCabinetId: number | null = ctx.state.primaryCabinetId || null;

  strapi.log.debug(`[CABINET-POLICY] ${method} request for user ${user?.id || 'unknown'}, cabinet=${primaryCabinetId}`);

  // Allow unauthenticated requests
  if (!user) {
    return true;
  }

  // Skip for Super Admin
  if (user.role?.type === "authenticated" && user.role?.name === "Super Admin") {
    strapi.log.debug(`[CABINET-POLICY] Super Admin access granted`);
    return true;
  }

  // Check if user has primary cabinet (set by session-auth middleware on ctx.state)
  if (!primaryCabinetId) {
    strapi.log.warn(`[CABINET-POLICY] User ${user.id} has no cabinet assigned`);
    ctx.status = 403;
    ctx.body = { error: "Nu ai cabinet asociat." };
    return false;
  }

  const route: Route = ctx.state.route;
  const contentType: string = route?.info?.apiName;

  strapi.log.debug(
    `[CABINET-POLICY] User ${user.id} accessing ${contentType} ${id || 'list'}, Cabinet: ${primaryCabinetId}`
  );
  
  // For single cabinet resource access, only allow user's own cabinet
  if (contentType === "cabinet" && id) {
    if (parseInt(id) !== primaryCabinetId) {
      strapi.log.warn(
        `[CABINET-POLICY] User ${user.id} denied access to cabinet ${id} (owns ${primaryCabinetId})`
      );
      return false;
    }
  }
  
  // For other single resource access, verify cabinet ownership
  if (id && method !== "POST" && ["pacient", "vizita", "plan-tratament", "price-list", "doctor", "factura", "plata"].includes(contentType)) {
    try {
      const uid = `api::${contentType}.${contentType}`;
      const entity = await strapi.entityService.findOne(uid, parseInt(id), {
        populate: ["cabinet"],
      });

      if (!entity) {
        strapi.log.warn(`[CABINET-POLICY] Entity ${contentType} ${id} not found`);
        return false;
      }

      const entityCabinetId = entity.cabinet?.id;
      
      if (entityCabinetId && entityCabinetId !== primaryCabinetId) {
        strapi.log.warn(
          `[CABINET-POLICY] User ${user.id} denied access to ${contentType} ${id} (different cabinet)`
        );
        return false;
      }
    } catch (error: any) {
      strapi.log.error(`[CABINET-POLICY] Error checking ${contentType} ${id}: ${error.message}`);
      return false;
    }
  }
  
  // For POST requests, ensure cabinet is set correctly
  if (method === "POST" && contentType !== "cabinet") {
    const requestBody: RequestBody = ctx.request.body || {};
    const { data } = requestBody;
    
    if (data) {
      if (data.cabinet) {
        const requestedCabinetId = typeof data.cabinet === "object" ? data.cabinet.id : data.cabinet;
        
        if (requestedCabinetId && Number(requestedCabinetId) !== Number(primaryCabinetId)) {
          strapi.log.warn(`[CABINET-POLICY] Wrong cabinet in POST request`);
          return false;
        }
      } else {
        // Auto-assign user's cabinet
        data.cabinet = primaryCabinetId;
        strapi.log.debug(`[CABINET-POLICY] Auto-assigned cabinet ${primaryCabinetId} to POST`);
      }
    }
  }
  
  // For PUT requests, prevent cabinet changes
  if (method === "PUT" && id) {
    const requestBody: RequestBody = ctx.request.body || {};
    const { data } = requestBody;
    
    if (data && data.cabinet) {
      const newCabinetId = typeof data.cabinet === "object" ? data.cabinet.id : data.cabinet;
      
      if (newCabinetId && parseInt(String(newCabinetId)) !== primaryCabinetId) {
        strapi.log.warn(`[CABINET-POLICY] Attempted cabinet change denied`);
        return false;
      }
    }
  }
  
  return true;
};