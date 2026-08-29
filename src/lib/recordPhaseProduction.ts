import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';

/**
 * Records production for a given phase + product.
 * - Updates current phase remaining
 * - Passes produced quantity to next phase
 * - Creates waste entries
 * - Marks final phase as ready for stock
 */
export async function recordPhaseProduction({
  productionId,
  phaseOrder,
  phaseId,
  productId,
  produced,
  damaged,
}: {
  productionId: string;
  phaseOrder: string[];
  phaseId: string;
  productId: string;
  produced: number;
  damaged: number;
}) {
  if (produced < 0 || damaged < 0) {
    throw new Error('Produced and damaged must be >= 0');
  }

  await runTransaction(db, async (transaction) => {
    const currentIndex = phaseOrder.indexOf(phaseId);
    if (currentIndex === -1) throw new Error('Invalid phaseId');

    // 🔑 Consistent document ID structure
    const currentRef = doc(
      db,
      'production_phase_state',
      `${productionId}_${phaseId}`
    );

    const nextRef =
      currentIndex + 1 < phaseOrder.length
        ? doc(
            db,
            'production_phase_state',
            `${productionId}_${phaseOrder[currentIndex + 1]}`
          )
        : null;

    // READ FIRST
    const currentSnap = await transaction.get(currentRef);
    const nextSnap = nextRef ? await transaction.get(nextRef) : null;

    const currentToProduce =
      currentSnap.exists() && typeof currentSnap.data().toProduce === 'number'
        ? currentSnap.data().toProduce
        : 0;

    const nextToProduce =
      nextSnap && nextSnap.exists() && typeof nextSnap.data().toProduce === 'number'
        ? nextSnap.data().toProduce
        : 0;

    // Remaining for this phase
    const remaining = Math.max(currentToProduce - (produced + damaged), 0);

    // Update current phase (ACCUMULATE, don't overwrite)
    transaction.set(
      currentRef,
      {
        productionId,
        productId,
        phaseId,
        toProduce: remaining,
        produced: (currentSnap.data()?.produced ?? 0) + produced,
        damaged: (currentSnap.data()?.damaged ?? 0) + damaged,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Waste entry
    if (damaged > 0) {
      const wasteRef = doc(collection(db, 'waste_entries'));
      transaction.set(wasteRef, {
        productionId,
        productId,
        phaseId,
        damagedQuantity: damaged,
        date: serverTimestamp(),
      });
    }

    // Pass GOOD pieces forward
    if (nextRef) {
      transaction.set(
        nextRef,
        {
          productionId,
          productId,
          phaseId: phaseOrder[currentIndex + 1],
          toProduce: nextToProduce + produced,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Final phase
      transaction.set(currentRef, { readyForStock: true }, { merge: true });
    }
  });
}
