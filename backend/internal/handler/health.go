package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (h *Handler) Health(c echo.Context) error {
	sqlDB, err := h.db.DB()
	if err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
	}
	if err := sqlDB.PingContext(c.Request().Context()); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"status": "unavailable"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
