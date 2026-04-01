export async function loadXLSX() {
  const mod = await import('xlsx');
  return mod.default || mod;
}
