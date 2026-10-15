require('../app');
const { getAllProduct, countRecommendedProducts } = require('../api/services/product-services');

async function test() {
  try {
    const products = await getAllProduct(0, 10, "");
    console.log("Number of products fetched:", products.records.length);
    if (products.records.length > 0) {
      console.log("Sample product format:", {
        id: products.records[0].id,
        product_name: products.records[0].product_name,
        is_recommended: products.records[0].is_recommended
      });
    }

    const recommendedCount = await countRecommendedProducts();
    console.log("Recommended products count:", recommendedCount);
    process.exit(0);
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

test();
