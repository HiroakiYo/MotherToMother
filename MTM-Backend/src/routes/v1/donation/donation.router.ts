import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import * as DonationService from "./donation.service";
import { getUserByEmail } from "../user/user.service";
import { getItemsCategoryName } from "../item/item.service";
import {
  type DonationRequestBodyType,
  type DonationDetailType,
  type OutgoingDonationStatsType,
} from "../../../types/donation";

const donationRouter = express.Router();

const createOutgoingDonation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Setting type of req.body to DonationRequestBodyType
    const donationReqBody = req.body as DonationRequestBodyType;

    if (!donationReqBody.userId) {
      // Then get the ID from the email
      const user = await getUserByEmail(donationReqBody.email);

      if (!user) {
        throw new Error(
          `No user with the given email: ${donationReqBody.email}`,
        );
      }

      donationReqBody.userId = user.id;
    }

    // Get the id for each item in outgoing donation request
    await Promise.all(
      donationReqBody.donationDetails.map(async (itemDetail, index) => {
        if (!itemDetail.itemId) {
          // Get the id from its category and name
          if (!itemDetail.category || !itemDetail.item) {
            throw new Error(
              "Missing a category or an item for one or more item on the request. ",
            );
          }

          const items = await getItemsCategoryName(
            itemDetail.category,
            itemDetail.item,
          );

          if (!items) {
            throw new Error(
              `No item with the given (category, name): (${itemDetail.category}, ${itemDetail.item})`,
            );
          } else if (items.length > 1) {
            throw new Error(
              `More than one item found by the given (category, name): (${itemDetail.category}, ${itemDetail.item})`,
            );
          }

          donationReqBody.donationDetails[index].itemId = items[0].id;
        }
      }),
    );

    const newDonation = await DonationService.createDonation(
      donationReqBody.userId,
    );

    donationReqBody.donationDetails.forEach(
      async (donationDetail: DonationDetailType) => {
        const newDonationDetail: DonationDetailType =
          await DonationService.createDonationDetails(
            donationDetail.itemId,
            newDonation.id,
            donationDetail,
          );
      },
    );

    const newOutgoingDonationStats: OutgoingDonationStatsType =
      await DonationService.createOutgoingDonationStats(
        newDonation.id,
        donationReqBody.numberServed,
        donationReqBody.whiteNum,
        donationReqBody.latinoNum,
        donationReqBody.blackNum,
        donationReqBody.nativeNum,
        donationReqBody.asianNum,
        donationReqBody.otherNum,
      );

    return res.status(200).json(newOutgoingDonationStats);
  } catch (e) {
    next(e);
  }
};

donationRouter.post("/createOutgoingDonation", createOutgoingDonation);

export { donationRouter };
