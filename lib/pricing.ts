export function calculatePrice(
  basePrice: number,
  supply: number,
  demand: number,
  regionMultiplier: number,
  eventMultiplier: number
) {
  const safeSupply = Math.max(1, supply);
  const ratio = demand / safeSupply;

  let price =
    basePrice *
    ratio *
    regionMultiplier *
    eventMultiplier;

  if (isNaN(price) || price < 1)
    price = 1;

  return Math.floor(price);
}
