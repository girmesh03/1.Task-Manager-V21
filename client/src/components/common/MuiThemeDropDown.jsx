import React, { useState, useEffect } from "react";
import { useColorScheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import DarkModeIcon from "@mui/icons-material/DarkModeRounded";
import LightModeIcon from "@mui/icons-material/LightModeRounded";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightnessRounded";

/**
 * MuiThemeDropDown component provides dynamic theme switching functionality
 * Features:
 * - System, light, and dark mode options
 * - Theme persistence using localStorage
 * - Seamless theme updates without page refresh
 * - Accessible keyboard navigation
 */
const MuiThemeDropDown = (props) => {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // Persist theme mode to localStorage whenever it changes
  useEffect(() => {
    if (mode) {
      localStorage.setItem("mui-mode", mode);
    }
  }, [mode]);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMode = (targetMode) => () => {
    setMode(targetMode);
    handleClose();
  };

  // If no mode is available, show loading state
  if (!mode) {
    return (
      <Box
        data-screenshot="toggle-mode"
        sx={(theme) => ({
          verticalAlign: "bottom",
          display: "inline-flex",
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: (theme.vars || theme).shape.borderRadius,
          border: "1px solid",
          borderColor: (theme.vars || theme).palette.divider,
          backgroundColor: (theme.vars || theme).palette.action.hover,
        })}
      />
    );
  }

  // Get the current resolved theme mode
  const resolvedMode = systemMode || mode;

  // Theme mode configurations
  const themeConfigs = {
    system: {
      icon: <SettingsBrightnessIcon />,
      label: "System",
      description: "Follow system preference",
    },
    light: {
      icon: <LightModeIcon />,
      label: "Light",
      description: "Light theme",
    },
    dark: {
      icon: <DarkModeIcon />,
      label: "Dark",
      description: "Dark theme",
    },
  };

  // Get current theme icon
  const currentIcon =
    themeConfigs[resolvedMode]?.icon || themeConfigs.system.icon;

  return (
    <React.Fragment>
      <IconButton
        data-screenshot="toggle-mode"
        onClick={handleClick}
        disableRipple
        aria-controls={open ? "theme-drop-down-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        aria-label={`Current theme: ${
          themeConfigs[mode]?.label || "System"
        }. Click to change theme.`}
        sx={(theme) => ({
          border: "none",
          color: (theme.vars || theme).palette.text.secondary,
        })}
        {...props}
      >
        {currentIcon}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        id="theme-drop-down-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        slotProps={{
          paper: {
            variant: "outlined",
            elevation: 0,
            sx: (theme) => ({
              my: 1,
              minWidth: 160,
              backgroundColor: (theme.vars || theme).palette.background.paper,
              border: `1px solid ${(theme.vars || theme).palette.divider}`,
            }),
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        {Object.entries(themeConfigs).map(([themeMode, config]) => (
          <MenuItem
            key={themeMode}
            selected={mode === themeMode}
            onClick={handleMode(themeMode)}
            sx={(theme) => ({
              minHeight: 40,
              "&.Mui-selected": {
                backgroundColor: (theme.vars || theme).palette.action.selected,
              },
            })}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{config.icon}</ListItemIcon>
            <ListItemText
              primary={config.label}
              secondary={config.description}
              slotProps={{
                primary: {
                 variant: "body2"
                },
                secondary: {
                 variant: "caption"
                },
              }}
            />
          </MenuItem>
        ))}
      </Menu>
    </React.Fragment>
  );
};

export default MuiThemeDropDown;
