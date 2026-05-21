package handler

import (
	"net/http"

	"nexttask/backend/internal/model"

	"github.com/labstack/echo/v4"
)

type taskGroupRequest struct {
	Name string `json:"name"`
}

func (h *Handler) ListTaskGroups(c echo.Context) error {
	var groups []model.TaskGroup
	if err := h.db.Order("created_at asc").Find(&groups).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, groups)
}

func (h *Handler) CreateTaskGroup(c echo.Context) error {
	var req taskGroupRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	if req.Name == "" {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "name is required")
	}
	id, err := newID()
	if err != nil {
		return err
	}
	group := model.TaskGroup{ID: id, Name: req.Name}
	if err := h.db.Create(&group).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, group)
}

func (h *Handler) UpdateTaskGroup(c echo.Context) error {
	var req taskGroupRequest
	if err := c.Bind(&req); err != nil {
		return errorResponse(c, http.StatusBadRequest, "invalid_request", "invalid request")
	}
	if req.Name == "" {
		return errorResponse(c, http.StatusBadRequest, "validation_error", "name is required")
	}
	var group model.TaskGroup
	if err := h.db.First(&group, "id = ?", c.Param("id")).Error; err != nil {
		return err
	}
	group.Name = req.Name
	if err := h.db.Save(&group).Error; err != nil {
		return err
	}
	return c.JSON(http.StatusOK, group)
}

func (h *Handler) DeleteTaskGroup(c echo.Context) error {
	if err := h.db.Delete(&model.TaskGroup{}, "id = ?", c.Param("id")).Error; err != nil {
		return err
	}
	return c.NoContent(http.StatusNoContent)
}
