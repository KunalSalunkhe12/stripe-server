const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const updateClerkUser = async (paymentInfo) => {
  try {
    const response = await axios.post(
      `${process.env.FRONTEND_URL}/api/stripe`,
      {
        paymentInfo,
      }
    );
    console.log("Clerk user updated:", response.data);
  } catch (error) {
    console.error("Error updating Clerk user:", error);
  }
};

module.exports = updateClerkUser;
