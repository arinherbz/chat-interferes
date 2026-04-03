import { ApiCheck, AssertionBuilder } from "checkly/constructs";

const baseUrl = process.env.CHECKLY_PUBLIC_BASE_URL || "https://ariostore-gadgets.onrender.com";

new ApiCheck("store-products-api", {
  name: "Store Products API",
  request: {
    url: `${baseUrl}/api/store/products`,
    method: "GET",
    assertions: [
      AssertionBuilder.statusCode().equals(200),
      AssertionBuilder.jsonBody("$.data").isNotNull(),
    ],
  },
});
