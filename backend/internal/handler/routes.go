package handler

import (
	"gorm.io/gorm"

	"github.com/labstack/echo/v4"
)

func RegisterRoutes(e *echo.Echo, db *gorm.DB, jwtSecret string) {
	h := New(db, jwtSecret)

	e.GET("/health", h.Health)

	api := e.Group("/api")
	api.POST("/auth/register", h.Register)
	api.POST("/auth/login", h.Login)

	protected := api.Group("", h.RequireAuth)
	protected.GET("/task-groups", h.ListTaskGroups)
	protected.POST("/task-groups", h.CreateTaskGroup)
	protected.PATCH("/task-groups/:id", h.UpdateTaskGroup)
	protected.DELETE("/task-groups/:id", h.DeleteTaskGroup)

	protected.GET("/tasks", h.ListTasks)
	protected.POST("/tasks", h.CreateTask)
	protected.PATCH("/tasks/:id", h.UpdateTask)
	protected.DELETE("/tasks/:id", h.DeleteTask)

	protected.GET("/export/ics", h.ExportICS)
}
