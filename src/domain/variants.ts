export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectDeterministicVariant<T>(
  seed: string,
  bankId: string,
  variants: readonly T[],
): T {
  if (variants.length === 0) {
    throw new Error(`Variant bank ${bankId} is empty.`);
  }
  const index = stableHash(`${seed}::${bankId}`) % variants.length;
  const selected = variants[index];
  if (selected === undefined) {
    throw new Error(`Variant bank ${bankId} could not select index ${index}.`);
  }
  return selected;
}
