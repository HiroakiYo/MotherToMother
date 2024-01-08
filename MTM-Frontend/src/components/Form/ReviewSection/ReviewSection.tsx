import {
  CssBaseline,
  ThemeProvider,
  Typography,
  Stack,
  Button,
  Box,
} from "@mui/material";
import { useState } from "react";
import { PrimaryMainTheme } from "../Theme";
import { ReviewSectionCategory } from "./ReviewSectionCategory";
import NumberInCircle from "./NumberInCircle";
import FormHeader from "../FormHeader";
import { useForm } from "../../../contexts/FormContext";

interface ReviewSectionProps {
  step: number;
}

const ReviewSection = (props: ReviewSectionProps) => {
  const { donationDetails } = useForm();
  const [isEditMode, setisEditMode] = useState(false);

  const handleEdit = () => {
    setisEditMode(true);
  };

  const handleSave = () => {
    setisEditMode(false);
  };

  const handleCancel = () => {
    setisEditMode(false);
  };

  const getDonationCategories = () => {
    return Array.from(new Set(donationDetails.map((item) => item.category)));
  };

  return (
    <>
      <CssBaseline />
      <ThemeProvider theme={PrimaryMainTheme}>
        <Box width="85%">
          {/* Header of Review Section */}
          <FormHeader number={props.step} header="Review" />

          {/* Main Content of Review Section */}
          <Stack
            direction="row"
            spacing={1}
            marginY="10px"
            justifyContent="center"
          >
            <NumberInCircle
              num={donationDetails.length}
              backgroundColor="#6D6D6D"
              color="white"
              borderRaduis="10px"
              width="50px"
              height="28px"
              borderWidth="0"
            />
            <Typography variant="body1"> items are in your form </Typography>
          </Stack>
          {getDonationCategories().map((category, i) => (
            <ReviewSectionCategory
              key={i}
              categoryName={category}
              isEditMode={isEditMode}
            />
          ))}
        </Box>
        {!isEditMode && (
          <Button
            variant="outlined"
            sx={{ fontSize: 15, height: "33px" }}
            onClick={handleEdit}
            style={{
              marginTop: "5%",
              backgroundColor: "white",
              color: "#A4A4A4",
              fontSize: 15,
              border: "1px solid #A4A4A4",
              borderRadius: "10px",
              height: "32px",
            }}
          >
            Edit
          </Button>
        )}
        {isEditMode && (
          <Stack direction="row" spacing={3} marginTop="50px">
            <Button
              variant="outlined"
              sx={{ fontSize: 15, height: "33px" }}
              color="primary"
              onClick={handleSave}
              style={{
                marginTop: "0",
                backgroundColor: "#A4A4A4",
                color: "white",
                fontSize: 15,
                border: "1px solid #c1c1c1",
                borderRadius: "10px",
                height: "32px",
                width: "87px",
              }}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              sx={{ fontSize: 15, height: "33px" }}
              onClick={handleCancel}
              style={{ marginTop: "0" }}
            >
              Cancel
            </Button>
          </Stack>
        )}
      </ThemeProvider>
    </>
  );
};

export default ReviewSection;
