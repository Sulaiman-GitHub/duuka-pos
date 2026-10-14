// Demo product catalog: category -> [name, buying cost, selling price] in whole UGX.
// Names are also the keys of prisma/product-images/manifest.json.
export const CATALOG: Record<string, [string, number, number][]> = {
  "Beverages": [["Mineral Water 500ml", 600, 1000], ["Mineral Water 1.5L", 1100, 1800], ["Coca-Cola 500ml", 1200, 2000], ["Fanta Orange 500ml", 1200, 2000], ["Passion Juice 1L", 3000, 4500], ["Tusker Lager 500ml", 3200, 4500], ["Milk 500ml", 1300, 1800]],
  "Groceries": [["Sugar 1kg", 4200, 5500], ["Rice 1kg", 4000, 5200], ["Cooking Oil 1L", 7500, 9500], ["Wheat Flour 1kg", 3500, 4500], ["Salt 500g", 800, 1200], ["Spaghetti 500g", 2500, 3500], ["Tea Leaves 100g", 1800, 2800], ["Eggs (tray of 30)", 11000, 14000]],
  "Bakery": [["Bread (sliced)", 3200, 4200], ["Chapati (5 pack)", 2500, 4000], ["Buns (6 pack)", 3000, 4500], ["Cake Slice", 2000, 3500]],
  "Personal Care": [["Bathing Soap", 1800, 2800], ["Toothpaste 100ml", 3500, 5000], ["Body Lotion 400ml", 8000, 12000], ["Sanitary Pads", 3000, 4500], ["Roll-on Deodorant", 4500, 7000], ["Shampoo 250ml", 6000, 9000]],
  "Household": [["Laundry Detergent 1kg", 6500, 9000], ["Dish Soap 500ml", 3000, 4500], ["Toilet Paper (4 roll)", 4000, 6000], ["Matchbox", 300, 500], ["Candles (6 pack)", 2500, 4000], ["Bleach 750ml", 3500, 5000]],
  "Stationery": [["Exercise Book 96pg", 1000, 1800], ["Ball Pen (blue)", 400, 800], ["Pencil HB", 300, 600], ["A4 Paper (ream)", 15000, 20000]],
  "Electronics": [["Phone Charger USB-C", 8000, 15000], ["Earphones", 6000, 12000], ["Torch (rechargeable)", 12000, 20000], ["AA Batteries (4 pack)", 3500, 6000], ["Power Bank 10000mAh", 35000, 55000]],
  "Snacks": [["Biscuits Pack", 1500, 2500], ["Crisps 50g", 1000, 1800], ["Chocolate Bar", 2000, 3500], ["Roasted Groundnuts", 1500, 2500]],
};
