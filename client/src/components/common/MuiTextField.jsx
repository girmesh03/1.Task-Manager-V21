// src/components/common/MuiTextField.jsx
import { forwardRef, useMemo } from "react";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

const MuiTextField = forwardRef(
  (
    {
      name,
      type = "text",
      startAdornment,
      endAdornment,
      error,
      helperText,
      onChange,
      onBlur,
      ...muiProps
    },
    ref
  ) => {
    const computedStartAdornment = useMemo(
      () =>
        startAdornment ? (
          <InputAdornment position="start">{startAdornment}</InputAdornment>
        ) : null,
      [startAdornment]
    );

    const computedEndAdornment = useMemo(
      () =>
        endAdornment ? (
          <InputAdornment position="end">{endAdornment}</InputAdornment>
        ) : null,
      [endAdornment]
    );

    return (
      <TextField
        {...muiProps}
        name={name}
        type={type}
        inputRef={ref}
        onChange={onChange}
        onBlur={onBlur}
        error={!!error}
        helperText={error?.message || helperText}
        slotProps={{
          input: {
            startAdornment: computedStartAdornment,
            endAdornment: computedEndAdornment,
          },
        }}
        sx={(theme) => ({
          "& .MuiButtonBase-root.MuiIconButton-root": {
            border: "none",
            backgroundColor: "transparent",
            color: (theme.vars || theme).palette.text.secondary,
            "&:hover": {
              backgroundColor: (theme.vars || theme).palette.action.hover,
              color: (theme.vars || theme).palette.text.primary,
            },
          },
        })}
      />
    );
  }
);

MuiTextField.displayName = "MuiTextField";

export default MuiTextField;
