import React, { useState, useEffect } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  MenuItem,
  Typography,
} from "@mui/material";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import ItemsTable from "./ItemsTable";
import DemographicTable from "./DemographicTable";
import {
  DemographicDetails,
  ItemDetails,
  ResponseDonation,
  ItemSelection,
} from "~/types/DonationTypes";
import {
  getDonationDemographics,
  getDonationDetails,
  editOutgoingDonation,
  getModalItems,
} from "../../lib/services";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SuccessMessage } from "../../components/SuccessMessage";

interface ModalContentProps {
  selectedDonation: ResponseDonation;
}

const DonationDetailsOutgoing: React.FC<ModalContentProps> = ({
  selectedDonation,
}) => {
  const [itemRows, setItemRows] = useState<ItemDetails[]>([]);
  const [initialItemRows, setInitialItemRows] = useState<ItemDetails[]>([]);
  const [initialDemographicRows, setInitialDemographicRows] = useState<
    DemographicDetails[]
  >([]);
  const [demographicRows, setDemographicRows] = useState<DemographicDetails[]>(
    []
  );
  const [itemList, setItemList] = useState<ItemSelection[]>([]);
  const [filteredItemList, setFilteredItemList] = useState<ItemSelection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [editable, setEditable] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [idItemCounter, setIdItemCounter] = useState(1);
  const [openAddItemDialog, setOpenAddItemDialog] = useState(false);
  const [selectedCategorySelection, setSelectedCategorySelection] = useState<
    string | null
  >();
  const [selectedItemSelection, setSelectedItemSelection] =
    useState<ItemSelection | null>(null);

  useEffect(() => {
    if (itemRows.length > 0) {
      setIdItemCounter(Math.max(...itemRows.map((item) => item.id)) + 1);
    }
  }, [itemRows]);

  useEffect(() => {
    const fetchItemRows = async () => {
      try {
        const response = await getDonationDetails(selectedDonation.id);
        if (response.ok) {
          const data = await response.json();
          const fetchedData: ItemDetails[] = data.map(
            (itemData: ItemDetails) => ({
              id: itemData.id,
              name: itemData.name,
              quantityNew: itemData.quantityNew,
              quantityUsed: itemData.quantityUsed,
              valueNew: itemData.valueNew,
              valueUsed: itemData.valueUsed,
            })
          );
          setItemRows(fetchedData);
          setInitialItemRows(fetchedData);
        } else {
          setError("Failed to fetch item rows");
        }
      } catch (error) {
        setError("Error fetching item rows:");
      }
    };

    const fetchDemographicRows = async () => {
      const response = await getDonationDemographics(selectedDonation.id);
      if (response.ok) {
        const data = await response.json();
        const fetchedData: DemographicDetails[] = [
          { id: 1, kidGroup: "White children", quantity: data.whiteNum },
          { id: 2, kidGroup: "Latino children", quantity: data.latinoNum },
          { id: 3, kidGroup: "Black children", quantity: data.blackNum },
          { id: 4, kidGroup: "Native children", quantity: data.nativeNum },
          { id: 5, kidGroup: "Asian children", quantity: data.asianNum },
          { id: 6, kidGroup: "Other children", quantity: data.otherNum },
        ];
        setDemographicRows(fetchedData);
        setInitialDemographicRows(fetchedData);
      } else {
        setError("Failed to fetch demographic rows");
      }
    };

    fetchItemRows();
    fetchDemographicRows();
  }, [selectedDonation]);

  useEffect(() => {
    const fetchItems = async () => {
      const response = await getModalItems();
      if (response.ok) {
        const data = await response.json();
        const fetchedItems: ItemSelection[] = data.map(
          (items: ItemSelection) => ({
            name: items.name,
            category: items.category,
            valueNew: items.valueNew,
            valueUsed: items.valueUsed,
          })
        );
        const fetchedCategories: string[] = Array.from(
          new Set(data.map((items: ItemSelection) => items.category))
        );
        setItemList(fetchedItems);
        setCategoryList(fetchedCategories);
      } else {
        setError("Failed to fetch items");
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    if (selectedCategorySelection) {
      const filteredItems = itemList.filter(
        (item) => item.category === selectedCategorySelection
      );
      setFilteredItemList(filteredItems);
    } else {
      setFilteredItemList(itemList);
    }
  }, [selectedCategorySelection, itemList]);

  const dateString = selectedDonation?.date
    ? new Date(selectedDonation.date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const handleEditButtonClick = () => {
    setEditable(!editable);
  };

  const handleCancelButtonClick = () => {
    setEditable(false);
    setItemRows(initialItemRows);
    setDemographicRows(initialDemographicRows);
  };

  const handleSaveButtonClick = () => {
    setOpenConfirmDialog(true);
  };

  const handleItemSelectionChange = (event: SelectChangeEvent<string>) => {
    const selectedItem = itemList.find(
      (item) => item.name === event.target.value
    );
    setSelectedItemSelection(selectedItem || null);
  };

  const handleCategorySelectionChange = (event: SelectChangeEvent<string>) => {
    setSelectedCategorySelection(event.target.value as string);
  };

  const totalQuantity = demographicRows
    .filter((row) => row.kidGroup)
    .reduce((total, row) => total + row.quantity, 0);

  const hasEmptyFields = itemRows.some(
    (row) => row.quantityNew === 0 && row.quantityUsed === 0
  );

  const handleConfirmSave = async () => {
    if (totalQuantity === 0) {
      setOpenConfirmDialog(false);
      setError("Number served cannot be zero.");
      return;
    }

    if (hasEmptyFields) {
      setOpenConfirmDialog(false);
      setError("Please fill all fields in the current rows before saving.");
      return;
    }

    const response = await editOutgoingDonation(selectedDonation.id, {
      numberServed: totalQuantity,

      whiteNum:
        demographicRows.find((row) => row.kidGroup === "White children")
          ?.quantity || 0,
      latinoNum:
        demographicRows.find((row) => row.kidGroup === "Latino children")
          ?.quantity || 0,
      blackNum:
        demographicRows.find((row) => row.kidGroup === "Black children")
          ?.quantity || 0,
      nativeNum:
        demographicRows.find((row) => row.kidGroup === "Native children")
          ?.quantity || 0,
      asianNum:
        demographicRows.find((row) => row.kidGroup === "Asian children")
          ?.quantity || 0,
      otherNum:
        demographicRows.find((row) => row.kidGroup === "Other children")
          ?.quantity || 0,
      donationDetails: itemRows.map((item) => ({
        item: item.name,
        usedQuantity: item.quantityNew,
        newQuantity: item.quantityUsed,
      })),
    });

    if (response.ok) {
      setInitialItemRows(itemRows);
      setInitialDemographicRows(demographicRows);
      setOpenConfirmDialog(false);
      setEditable(false);
      setSuccess(true);
    } else {
      setOpenConfirmDialog(false);
      setError("Failed to save changes");
    }
  };

  const handleCancelConfirm = () => {
    setOpenConfirmDialog(false);
  };

  const handleAddItemButtonClick = () => {
    if (hasEmptyFields) {
      setError(
        "Please fill all fields in the current rows before adding a new row."
      );
    } else {
      setOpenAddItemDialog(true);
    }
  };

  const handleAddDialog = () => {
    if (!selectedItemSelection) {
      return;
    }

    setItemRows((prevRows) => [
      ...prevRows,
      {
        id: idItemCounter + 1,
        name: selectedItemSelection.name,
        valueNew: selectedItemSelection.valueNew || 0,
        valueUsed: selectedItemSelection.valueUsed || 0,
        quantityNew: 0,
        quantityUsed: 0,
      },
    ]);
    setIdItemCounter(idItemCounter + 1);
    setOpenAddItemDialog(false);
    setSelectedCategorySelection("");
    setSelectedItemSelection(null);
  };

  const handleCloseAddDialog = () => {
    setSelectedCategorySelection("");
    setSelectedItemSelection(null);
    setOpenAddItemDialog(false);
  };

  return (
    <Box p={2} sx={{ overflowY: "auto" }}>
      {error && <ErrorMessage error={error} setError={setError} />}
      {success && <SuccessMessage success={success} setSuccess={setSuccess} />}
      <Typography
        fontFamily="Raleway, sans-serif"
        fontSize={13}
        color="navy"
        mb={1}
        style={{ letterSpacing: "2px" }}
      >
        DONATION SUMMARY
      </Typography>
      <div style={{ display: "flex" }}>
        <Typography
          fontFamily="Raleway, sans-serif"
          fontSize={30}
          fontWeight="bold"
          color="navy"
        >
          #{selectedDonation.id}
        </Typography>

        <div
          style={{
            backgroundColor: "lightgray",
            display: "inline-block",
            padding: "3px 10px 3px 10px",
            borderRadius: "15px",
            marginTop: "8px",
            marginBottom: "10px",
            marginLeft: "15px",
          }}
        >
          {selectedDonation.type}
        </div>
      </div>

      <Typography
        fontFamily="Raleway, sans-serif"
        fontSize={15}
        color="#6D6D6D"
        mb={2}
        style={{ display: "inline-block" }}
      >
        {dateString} to{" "}
        <span style={{ textDecoration: "underline" }}>
          {selectedDonation.organization}
        </span>
      </Typography>

      <Box>
        {!editable && (
          <button className="edit-button" onClick={handleEditButtonClick}>
            Edit
          </button>
        )}
        {editable && (
          <>
            <button
              className="inner-edit-button"
              onClick={handleSaveButtonClick}
            >
              Save
            </button>
            <button
              className="inner-edit-button"
              onClick={handleCancelButtonClick}
            >
              Cancel
            </button>
            <button
              className="inner-edit-button"
              onClick={handleAddItemButtonClick}
            >
              Add Item
            </button>
          </>
        )}
      </Box>
      <div
        style={{
          border: "none",
        }}
      >
        <ItemsTable rows={itemRows} setRows={setItemRows} editable={editable} />
      </div>
      <div>
        <DemographicTable
          rows={demographicRows}
          setRows={setDemographicRows}
          editable={editable}
        />
      </div>
      <div className="add-item">
        <Dialog
          open={openAddItemDialog}
          onClose={handleCloseAddDialog}
          maxWidth="lg"
        >
          <DialogTitle fontFamily={"raleway, sans-sherif"}>
            Add Item
          </DialogTitle>
          <DialogContent>
            <div style={{ display: "flex" }}>
              <Typography
                fontFamily={"raleway, sans-sherif"}
                marginRight={2}
                marginBottom={2}
              >
                Category
              </Typography>
              <FormControl fullWidth>
                <Select
                  id="category"
                  value={
                    selectedCategorySelection ? selectedCategorySelection : ""
                  }
                  onChange={handleCategorySelectionChange}
                >
                  {categoryList.map((category, index) => (
                    <MenuItem key={index} value={category.toString()}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div style={{ display: "flex" }}>
              <Typography fontFamily={"raleway, sans-sherif"} marginRight={6.4}>
                Item
              </Typography>
              <FormControl fullWidth disabled={!selectedCategorySelection}>
                <Select
                  id="item-selection"
                  value={
                    selectedItemSelection ? selectedItemSelection.name : ""
                  }
                  onChange={handleItemSelectionChange}
                >
                  {filteredItemList.map((item) => (
                    <MenuItem value={item.name}>{item.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </DialogContent>
          <DialogActions>
            <button className="dialog-button" onClick={handleCloseAddDialog}>
              Cancel
            </button>
            <button
              className="dialog-button"
              onClick={() => {
                handleAddDialog();
              }}
            >
              Add
            </button>
          </DialogActions>
        </Dialog>
        <Dialog open={openConfirmDialog} onClose={handleCancelConfirm}>
          <DialogTitle>Confirm Save</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to save changes?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <button className="dialog-button" onClick={handleCancelConfirm}>
              Cancel
            </button>
            <button className="dialog-button" onClick={handleConfirmSave}>
              Save
            </button>
          </DialogActions>
        </Dialog>
      </div>
    </Box>
  );
};

export default DonationDetailsOutgoing;
