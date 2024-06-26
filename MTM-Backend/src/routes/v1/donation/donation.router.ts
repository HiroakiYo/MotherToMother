import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import * as DonationService from "./donation.service";
import { getUserByEmail } from "../user/user.service";
import {
  getItemsCategoryName,
  updateItem,
  getItemsName,
  getItemFromID,
} from "../item/item.service";
import type {
  OutgoingDonationRequestBodyType,
  DonationDetailType,
  OutgoingDonationStatsType,
  IncomingDonationType,
  IncomingDonationTypeWithID,
  IncomingDonationWithIDType,
  DonationQueryType,
  DonationsDashboardDisplay,
  PUTOutgoingDonationRequestBodyType,
} from "../../../types/donation";
import {
  translateFilterToPrisma,
  translateSortToPrisma,
} from "../../../utils/lib";
import type { Prisma } from "@prisma/client";

interface QueryTypeID {
  id: string;
}

const donationRouter = express.Router();

donationRouter.get(
  "/v1",
  async (
    req: Request<any, any, any, DonationQueryType>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const query = req.query;
      const { page, pageSize, sort, order, ...filters } = query;
      const pageInt = Number(page);
      const pageSizeInt = Number(pageSize);
      const typedFilters = {
        ...filters,
        id: filters.id && Number(filters.id),
      };
      const whereClause = translateFilterToPrisma(
        typedFilters,
      ) as DonationsDashboardDisplay;
      const orderBy = translateSortToPrisma(
        sort,
        order,
      ) as Prisma.user_dashboardAvgOrderByAggregateInput;
      const donationsAP = await DonationService.getDonationsAP(
        pageInt,
        pageSizeInt,
        whereClause,
        orderBy,
      );
      const count =
        await DonationService.getDonationDashboardCount(whereClause);
      return res.status(200).json({ donationsAP, totalNumber: count });
    } catch (e) {
      console.error(e);
      next(e);
    }
  },
);

const isNonNegativeInteger = (value: number) => {
  return value >= 0 && Number.isInteger(value);
};

const createOutgoingDonation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Setting type of req.body to OutgoingDonationRequestBodyType
    const donationReqBody = req.body as OutgoingDonationRequestBodyType;

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

          // Check if quantity is valid (not negative integer)
          if (!isNonNegativeInteger(itemDetail.newQuantity)) {
            throw new Error("Quantity of items must be non-negative integers");
          }

          donationReqBody.donationDetails[index].itemId = items[0].id;
        }
      }),
    );

    // Validate the numberServed and demographic numbers
    if (
      !isNonNegativeInteger(donationReqBody.numberServed) ||
      !isNonNegativeInteger(donationReqBody.whiteNum) ||
      !isNonNegativeInteger(donationReqBody.latinoNum) ||
      !isNonNegativeInteger(donationReqBody.blackNum) ||
      !isNonNegativeInteger(donationReqBody.nativeNum) ||
      !isNonNegativeInteger(donationReqBody.asianNum) ||
      !isNonNegativeInteger(donationReqBody.otherNum)
    ) {
      throw new Error(
        "NumberServed and demographic numbers must be non-negative integers",
      );
    }

    // Check that stock amount is enough for each item
    await Promise.all(
      donationReqBody.donationDetails.map(async (itemDetail) => {
        const item = await getItemsName(itemDetail.item!);

        if (!item) {
          throw new Error(`No item with the given name: ${itemDetail.item}`);
        } else if (item.length > 1) {
          throw new Error(
            `More than one item found by the given name: ${itemDetail.item}`,
          );
        }

        if (item[0].quantityNew < itemDetail.newQuantity) {
          throw new Error(
            `Not enough stock for the new item: ${itemDetail.item}. Stock: ${item[0].quantityNew}`,
          );
        }

        if (item[0].quantityUsed < itemDetail.usedQuantity) {
          throw new Error(
            `Not enough stock for the used item: ${itemDetail.item}. Stock: ${item[0].quantityUsed}`,
          );
        }
      }),
    );

    // ----------------------- Here, it start updating the database -------------------------------
    const newDonation = await DonationService.createDonation(
      donationReqBody.userId,
      donationReqBody.date,
    );

    donationReqBody.donationDetails.forEach(
      async (donationDetail: DonationDetailType) => {
        await DonationService.createDonationDetails(
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

    // Update the quantity of each item
    await Promise.all(
      donationReqBody.donationDetails.map(async (itemDetail) => {
        await updateItem(
          itemDetail.itemId,
          -itemDetail.usedQuantity,
          -itemDetail.newQuantity,
        );
      }),
    );

    return res.status(200).json(newOutgoingDonationStats);
  } catch (e) {
    next(e);
  }
};

const updateOutgoingDonation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const donationReqBody = req.body as PUTOutgoingDonationRequestBodyType;
    const donationIdString = req.params.donationId;

    // ------------------------------------ Validations ------------------------------------
    if (!donationIdString) {
      throw new Error("Missing donationId");
    } else if (!isNonNegativeInteger(parseInt(donationIdString, 10))) {
      throw new Error("DonationId must be a non-negative integer");
    }
    const donationId = parseInt(donationIdString, 10);

    if (
      !isNonNegativeInteger(donationReqBody.numberServed) ||
      !isNonNegativeInteger(donationReqBody.whiteNum) ||
      !isNonNegativeInteger(donationReqBody.latinoNum) ||
      !isNonNegativeInteger(donationReqBody.blackNum) ||
      !isNonNegativeInteger(donationReqBody.nativeNum) ||
      !isNonNegativeInteger(donationReqBody.asianNum) ||
      !isNonNegativeInteger(donationReqBody.otherNum)
    ) {
      throw new Error(
        "NumberServed and demographic numbers must be non-negative integers",
      );
    }

    // -------------------------- Item Validation ------------------------------
    for (const donationDetail of donationReqBody.donationDetails) {
      if (
        !isNonNegativeInteger(donationDetail.usedQuantity) ||
        !isNonNegativeInteger(donationDetail.newQuantity)
      ) {
        throw new Error("Quantity of items must be non-negative integers");
      }

      if (!donationDetail.item) {
        throw new Error("Missing item name");
      }

      // Check if item exists in the database
      const items = await getItemsName(donationDetail.item);

      if (!items) {
        throw new Error(`No item with the given name: ${donationDetail.item}`);
      } else if (items.length > 1) {
        throw new Error(
          `More than one item found by the given name: ${donationDetail.item}`,
        );
      }
    }

    console.log("Done with validations");

    // Check that stock amount is enough for each item
    await Promise.all(
      donationReqBody.donationDetails.map(async (donationDetail) => {
        const item = await getItemsName(donationDetail.item!);

        if (!item) {
          throw new Error(
            `No item with the given name: ${donationDetail.item}`,
          );
        } else if (item.length > 1) {
          throw new Error(
            `More than one item found by the given name: ${donationDetail.item}`,
          );
        }

        const prevDonationDetail = await DonationService.getDonationDetails(
          donationId,
          item[0].id,
        );

        if (!prevDonationDetail) {
          // If it is new item is not in the donation
          if (item[0].quantityNew < donationDetail.newQuantity) {
            throw new Error(
              `Not enough stock for the new item: ${donationDetail.item}. Stock: ${item[0].quantityNew}`,
            );
          }

          if (item[0].quantityUsed < donationDetail.usedQuantity) {
            throw new Error(
              `Not enough stock for the used item: ${donationDetail.item}. Stock: ${item[0].quantityUsed}`,
            );
          }
        } else {
          // If it is an existing item in the donation, update by the difference
          if (
            item[0].quantityNew + prevDonationDetail.newQuantity <
            donationDetail.newQuantity
          ) {
            throw new Error(
              `Not enough stock for the new item: ${
                donationDetail.item
              }. Stock: ${
                item[0].quantityNew + prevDonationDetail.newQuantity
              }`,
            );
          }

          if (
            item[0].quantityUsed + prevDonationDetail.usedQuantity <
            donationDetail.usedQuantity
          ) {
            throw new Error(
              `Not enough stock for the used item: ${
                donationDetail.item
              }. Stock: ${
                item[0].quantityUsed + prevDonationDetail.usedQuantity
              }`,
            );
          }
        }
      }),
    );

    // ---------------------- Updating the OutgoingDonationStats Table -------------------------
    await DonationService.updateOutgoingDonationStats(
      donationId,
      donationReqBody.numberServed,
      donationReqBody.whiteNum,
      donationReqBody.latinoNum,
      donationReqBody.blackNum,
      donationReqBody.nativeNum,
      donationReqBody.asianNum,
      donationReqBody.otherNum,
    );

    // Update the DonationDetails Table and the Item Table
    await Promise.all(
      donationReqBody.donationDetails.map(async (donationDetail) => {
        const itemFromName = await getItemsName(donationDetail.item!);
        donationDetail.itemId = itemFromName![0].id;

        const prevDonationDetail = await DonationService.getDonationDetails(
          donationId,
          donationDetail.itemId,
        );

        await DonationService.updateDonationDetails(donationId, donationDetail);

        if (prevDonationDetail) {
          await updateItem(
            donationDetail.itemId,
            prevDonationDetail.usedQuantity - donationDetail.usedQuantity,
            prevDonationDetail.newQuantity - donationDetail.newQuantity,
          );
        } else {
          await updateItem(
            donationDetail.itemId,
            -donationDetail.usedQuantity,
            -donationDetail.newQuantity,
          );
        }
      }),
    );

    // If an item is removed from donation when updating, then item is added back to the inventory
    const updatedDeletedItems = async () => {
      const getAllItemsInDonation =
        await DonationService.getAllItemsInDonation(donationId);
      getAllItemsInDonation.forEach(async (item) => {
        const itemInNewDonation = donationReqBody.donationDetails.find(
          (itemDetail) => itemDetail.itemId === item.itemId,
        );

        // Reset back the quantity of the item in the inventory
        if (!itemInNewDonation) {
          await updateItem(item.itemId, item.usedQuantity, item.newQuantity);

          // Update the deleted items in the DonationDetails Table
          await DonationService.deleteRowInDonationDetails(
            donationId,
            item.itemId,
          );
        }
      });
    };

    await updatedDeletedItems();

    // Update Date in Donation Table
    await DonationService.updateDonationDate(donationId, new Date());

    return res.status(200).json({ message: "Outgoing Donation Updated" });
  } catch (e) {
    next(e);
  }
};

donationRouter.post(
  "/v1/incoming",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const donationReqBody = req.body as IncomingDonationTypeWithID;
      if (!donationReqBody.userId) {
        return res.status(400).json({
          error: "User ID must be entered",
        });
      }
      // make sure the user exists by checking the id in the database
      const createdDonation =
        await DonationService.createIncomingDonation(donationReqBody);

      if (createdDonation) {
        return res.status(200).json({
          createdDonation,
        });
      } else {
        return res.status(400).json({
          error: "User does not exist",
        });
      }
    } catch (e) {
      next(e);
    }
  },
);

donationRouter.put(
  "/v1/incoming",
  async (
    req: Request<any, any, any, QueryTypeID>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const body = req.body as IncomingDonationType;
      const donationId = parseInt(req.query.id);
      if (!donationId) {
        return res.status(400).json({
          error: "ID must be entered",
        });
      }

      // create object with IncomingDonationWithIDType
      const incomingDonation: IncomingDonationWithIDType = {
        id: donationId,
        donationDetails: body.donationDetails,
      };

      const donations =
        await DonationService.updateIncomingDonation(incomingDonation);

      if (donations) {
        return res.status(200).json({
          donations,
        });
      } else {
        return res.status(400).json({
          error: "Donation does not exist",
        });
      }
    } catch (e) {
      next(e);
    }
  },
);

donationRouter.get(
  "/v1/details/:donationId",
  async (
    req: Request<any, any, any, any>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const donationId = req.params.donationId;

      const donationDetails = await DonationService.getDonationDetailsId(
        parseInt(donationId),
      );

      const itemDetails = [];

      for (const detail of donationDetails) {
        const itemId = detail.itemId;

        const item = await getItemFromID(itemId);

        itemDetails.push({
          id: itemId,
          name: item?.name,
          quantityUsed: detail.usedQuantity,
          quantityNew: detail.newQuantity,
          valueUsed: item?.valueUsed,
          valueNew: item?.valueNew,
        });
      }

      return res.status(200).json(itemDetails);
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

donationRouter.get(
  "/v1/demographics/:donationId",
  async (req: Request<any, any, any, any>, res: Response) => {
    try {
      const donationId = req.params.donationId;
      const donationDetails = await DonationService.getDemographicDetailsId(
        parseInt(donationId),
      );
      return res.status(200).json(donationDetails);
    } catch (error) {
      console.error("Error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  },
);

export { donationRouter };

donationRouter.post("/v1/outgoing", createOutgoingDonation);
donationRouter.put("/v1/outgoing/:donationId", updateOutgoingDonation);
