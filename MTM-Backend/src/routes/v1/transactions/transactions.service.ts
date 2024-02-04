import { db } from "../../../utils/db.server";

export const getTransactions = async (page: number, pageSize: number) => {
  // print type of page and pageSize
  console.log(typeof page, typeof pageSize);
  const skip = (page - 1) * pageSize;
  const donations = await db.donation.findMany({
    skip,
    take: pageSize,
    include: {
      user: {
        include: {
          Organization: true,
        },
      },
      DonationDetail: {
        include: {
          item: true,
        },
      },
    },
  });

  const transformedData = donations.map((donation) => {
    const details = donation.DonationDetail.map((detail) => ({
      item: detail.item.name,
      status: detail.usedQuantity > 0 ? "Used" : "New",
      value:
        detail.usedQuantity > 0 ? detail.item.valueUsed : detail.item.valueNew,
      quantity:
        detail.usedQuantity > 0 ? detail.usedQuantity : detail.newQuantity,
      total:
        detail.usedQuantity * detail.item.valueUsed +
        detail.newQuantity * detail.item.valueNew,
    }));

    const total = details.reduce((acc, detail) => acc + detail.total, 0);

    return {
      id: donation.id,
      date: donation.date,
      organization: donation.user.Organization?.name || "Individual",
      total: total,
      items: details.length,
      type: donation.user.Organization
        ? donation.user.Organization.type
        : "Individual",
      details: details,
    };
  });

  return transformedData;
};
