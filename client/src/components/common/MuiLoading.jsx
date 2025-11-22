// client/src/components/common/MuiLoading.jsx
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { LOADING_MESSAGES } from "../../utils/constants.js";

export const LoadingFallback = ({
  message = LOADING_MESSAGES.LOADING,
  height = "100vh",
  sx = {},
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        height: height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        ...sx,
      }}
    >
      <CircularProgress size={40} thickness={4} disableShrink />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export const BackdropFallback = ({
  message = LOADING_MESSAGES.LOADING,
  open,
  sx = {},
}) => {
  return (
    <Backdrop open={open}>
      <LoadingFallback message={message} sx={sx} />
    </Backdrop>
  );
};

export const NavigationLoader = () => {
  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 3,
      }}
    >
      <LinearProgress
        color="primary"
        sx={{
          height: 3,
          backgroundColor: "transparent",
          "& .MuiLinearProgress-bar": { transition: "transform 0.2s linear" },
        }}
      />
    </Box>
  );
};

export const ContentLoader = ({ isLoading, children }) => {
  return (
    <Box
      sx={{
        position: "relative",
        opacity: isLoading ? 0.7 : 1,
        transition: "opacity 0.2s ease-in-out",
      }}
    >
      {children}
      {isLoading && (
        <Box sx={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}>
          <CircularProgress size={20} thickness={4} disableShrink />
        </Box>
      )}
    </Box>
  );
};

LoadingFallback.propTypes = {
  message: PropTypes.string,
  sx: PropTypes.object,
};

export default LoadingFallback;
