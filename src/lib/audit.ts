import { prisma } from "@/lib/prisma";

/**
 * Creates an audit log entry.
 *
 * @param userId - The ID of the user performing the action
 * @param action - A short description of the action (e.g., "CREATE", "UPDATE", "DELETE")
 * @param entityType - The type of entity being acted upon (e.g., "Product", "Retailer", "DeliveryOrder")
 * @param entityId - The ID of the entity
 * @param before - Optional JSON snapshot of the entity before the change
 * @param after - Optional JSON snapshot of the entity after the change
 */
export async function logAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  before?: unknown,
  after?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        before: before !== undefined ? (before as object) : undefined,
        after: after !== undefined ? (after as object) : undefined,
      },
    });
  } catch (error) {
    // Log but don't throw — audit failures should not block primary operations
    console.error("Failed to create audit log entry:", error);
  }
}
