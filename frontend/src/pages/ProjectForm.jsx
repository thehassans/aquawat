import React, { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSelector } from "react-redux"
import { useForm, Controller } from "react-hook-form"
import { Calendar, Save, ArrowLeft, Download } from "lucide-react"
import toast from "react-hot-toast"

import api from "../lib/api"
import { useTranslation } from "../lib/translations"
import { useLiveTranslation } from "../lib/liveTranslation"
import { downloadProjectProgressPdf } from "../lib/projectProgressPdf"
import { showArabicFields as isArabicTenantMarket } from "../lib/saudiTenant"

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Badge } from "../components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "../components/ui/select"

const CircleProgress = ({
  value,
  maxValue,
  size = 40,
  strokeWidth = 3,
  className = "",
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fillPercentage = Math.min(value / maxValue, 1)
  const strokeDashoffset = circumference * (1 - fillPercentage)

  const getColor = (percentage) => {
    if (percentage < 0.7) return "stroke-emerald-500"
    if (percentage < 0.9) return "stroke-amber-500"
    return "stroke-red-500"
  }

  const currentColor = getColor(fillPercentage)

  return (
    <div className={className}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fill-transparent stroke-gray-200 dark:stroke-gray-700"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-transparent transition-colors ${currentColor}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default function ProjectForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { language } = useSelector((state) => state.ui)
  const { tenant } = useSelector((state) => state.auth)
  const { t } = useTranslation(language)
  const showArabicFields = isArabicTenantMarket(tenant)

  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const isEdit = Boolean(id)

  const { data: usersData } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => api.get("/users", { params: { limit: 200 } }).then((res) => res.data.users || []),
  })

  const formatDateForInput = (value) => {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
  } = useForm({
    defaultValues: {
      code: "",
      status: "planned",
      nameEn: "",
      nameAr: "",
      ownerName: "",
      startDate: "",
      dueDate: "",
      progress: 0,
      budget: 0,
      currency: tenant?.settings?.currency || "SAR",
      description: "",
      notes: "",
    },
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: "nameEn",
    targetField: "nameAr",
    sourceLang: "en",
    targetLang: "ar",
    enabled: showArabicFields,
  })

  useLiveTranslation({
    control,
    watch,
    setValue,
    sourceField: "nameAr",
    targetField: "nameEn",
    sourceLang: "ar",
    targetLang: "en",
    enabled: showArabicFields,
  })

  const progress = watch("progress")
  const status = watch("status")

  const { data: projectData, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.get(`/projects/${id}`).then((res) => res.data),
    enabled: isEdit,
    onSuccess: (data) => {
      reset({
        code: data?.code || "",
        status: data?.status || "planned",
        nameEn: data?.nameEn || "",
        nameAr: data?.nameAr || "",
        ownerName: data?.ownerName || "",
        startDate: formatDateForInput(data?.startDate),
        dueDate: formatDateForInput(data?.dueDate),
        progress: data?.progress ?? 0,
        budget: data?.budget ?? 0,
        currency: data?.currency || tenant?.settings?.currency || "SAR",
        description: data?.description || "",
        notes: data?.notes || "",
      })
    },
  })

  const progressMutation = useMutation({
    mutationFn: ({ progress, note }) =>
      api.post(`/projects/${id}/progress`, { progress, note }).then((r) => r.data),
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث التقدم" : "Progress updated")
      queryClient.invalidateQueries(["project", id])
      queryClient.invalidateQueries(["projects"])
    },
    onError: (err) => toast.error(err.response?.data?.error || "Error"),
  })

  const addProgressReport = (e) => {
    e.preventDefault()
    if (!newReport.note) return
    progressMutation.mutate({
      progress: Number(newReport.progress),
      note: newReport.note,
    })
    setNewReport({ date: formatDateForInput(new Date()), note: "", progress: Number(progress) })
  }

  const [newReport, setNewReport] = useState({
    date: formatDateForInput(new Date()),
    note: "",
    progress: 0,
  })

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? api.put(`/projects/${id}`, data) : api.post("/projects", data)),
    onSuccess: () => {
      toast.success(
        isEdit
          ? language === "ar"
            ? "تم تحديث المشروع"
            : "Project updated"
          : language === "ar"
            ? "تم إضافة المشروع"
            : "Project added"
      )
      queryClient.invalidateQueries(["projects"])
      queryClient.invalidateQueries(["projects-stats"])
      navigate("/projects")
    },
    onError: (err) => toast.error(err.response?.data?.error || "Error"),
  })

  const onSubmit = (data) => {
    const p = Number(data.progress)
    const budget = Number(data.budget)

    const payload = {
      ...data,
      progress: Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0,
      budget: Number.isFinite(budget) ? Math.max(0, budget) : 0,
      startDate: data.startDate || undefined,
      dueDate: data.dueDate || undefined,
    }

    mutation.mutate(payload)
  }

  const getStatusColor = (s) => {
    switch (s) {
      case "planned":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "in-progress":
      case "in_progress":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "on-hold":
      case "on_hold":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const safeProgress = Math.max(0, Math.min(100, Number(progress || 0)))
  const progressUpdates = Array.isArray(projectData?.progressUpdates) ? projectData.progressUpdates : []
  const budget = watch("budget") || 0
  const currency = watch("currency") || "SAR"
  const startDate = watch("startDate")
  const dueDate = watch("dueDate")

  return (
    <div id="project-report-container" className="w-full max-w-7xl mx-auto p-4 space-y-6 bg-background text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn btn-ghost btn-icon no-print">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold">
            {isEdit
              ? language === "ar"
                ? "تقرير المشروع"
                : "Project Report"
              : language === "ar"
              ? "إضافة مشروع"
              : "Add Project"}
          </h1>
          <Badge className={getStatusColor(status)}>
            {status?.replace("_", " ")?.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-3 no-print">
          {isEdit && projectData && (
            <button
              type="button"
              onClick={async () => {
                try {
                  setDownloadingPdf(true)
                  const full = await api.get(`/projects/${id}`).then((r) => r.data)
                  await downloadProjectProgressPdf({ project: full, language, tenant })
                } catch (e) {
                  toast.error(language === "ar" ? "فشل تحميل PDF" : "Failed to download PDF")
                } finally {
                  setDownloadingPdf(false)
                }
              }}
              disabled={downloadingPdf}
              className="btn btn-secondary flex items-center gap-2"
            >
              {downloadingPdf ? (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {language === "ar" ? "تحميل التقرير" : "Download Report"}
            </button>
          )}
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
            className="btn btn-primary flex items-center gap-2"
          >
            {mutation.isPending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t("save")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{language === "ar" ? "معلومات المشروع" : "Project Information"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">{language === "ar" ? "الكود" : "Code"}</Label>
                <Input
                  id="code"
                  {...register("code")}
                  disabled={isEdit}
                  placeholder={language === "ar" ? "تلقائي" : "Auto"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t("status")}</Label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">{language === "ar" ? "مخطط" : "Planned"}</SelectItem>
                        <SelectItem value="in_progress">
                          {language === "ar" ? "قيد التنفيذ" : "In Progress"}
                        </SelectItem>
                        <SelectItem value="completed">
                          {language === "ar" ? "مكتمل" : "Completed"}
                        </SelectItem>
                        <SelectItem value="on_hold">{language === "ar" ? "متوقف" : "On Hold"}</SelectItem>
                        <SelectItem value="cancelled">{language === "ar" ? "ملغي" : "Cancelled"}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ownerName">{language === "ar" ? "المالك" : "Owner"}</Label>
                <Controller
                  name="ownerName"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={language === "ar" ? "اختر المالك" : "Select owner"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>{language === "ar" ? "الموظفون" : "Employees"}</SelectLabel>
                          {employeesData?.map((emp) => (
                            <SelectItem key={emp._id} value={`${emp.firstName} ${emp.lastName}`}>
                              {emp.firstName} {emp.lastName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>{language === "ar" ? "المستخدمون" : "Users"}</SelectLabel>
                          {usersData?.map((u) => (
                            <SelectItem key={u._id} value={`${u.firstName} ${u.lastName}`}>
                              {u.firstName} {u.lastName}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className={showArabicFields ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
                <div className="space-y-2">
                  <Label htmlFor="nameEn">{showArabicFields ? (language === "ar" ? "الاسم (EN)" : "Name (EN)") : (language === "ar" ? "الاسم" : "Name")} *</Label>
                  <Input id="nameEn" {...register("nameEn", { required: true })} />
                </div>

                {showArabicFields ? (
                  <div className="space-y-2">
                    <Label htmlFor="nameAr" className="text-right block">
                      {language === "ar" ? "الاسم (AR)" : "Name (AR)"}
                    </Label>
                    <Input id="nameAr" {...register("nameAr")} dir="rtl" className="text-right" />
                  </div>
                ) : (
                  <input type="hidden" {...register("nameAr")} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{language === "ar" ? "الوصف" : "Description"}</Label>
                <Textarea id="description" {...register("description")} rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "نظرة عامة" : "Progress Overview"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative">
                <CircleProgress value={safeProgress} maxValue={100} size={120} strokeWidth={8} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{safeProgress}%</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {language === "ar" ? "اكتمال المشروع" : "Project Completion"}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "الميزانية" : "Budget"}
                </span>
                <span className="font-semibold text-lg">
                  {Number(budget).toLocaleString()} {currency}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "تاريخ البداية" : "Start Date"}
                </span>
                <span className="font-semibold">{startDate || "-"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "تاريخ الانتهاء" : "Due Date"}
                </span>
                <span className="font-semibold">{dueDate || "-"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "الجدول والميزانية" : "Schedule & Budget"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{language === "ar" ? "تاريخ البداية" : "Start Date"}</Label>
              <div className="relative">
                <Input id="startDate" type="date" {...register("startDate")} />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">{language === "ar" ? "تاريخ الانتهاء" : "Due Date"}</Label>
              <div className="relative">
                <Input id="dueDate" type="date" {...register("dueDate")} />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="progress">{language === "ar" ? "التقدم (%)" : "Progress (%)"}</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                {...register("progress", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">{language === "ar" ? "الميزانية" : "Budget"}</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                {...register("budget", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{language === "ar" ? "العملة" : "Currency"}</Label>
              <Input id="currency" {...register("currency")} disabled />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="notes">{language === "ar" ? "ملاحظات عامة" : "General Notes"}</Label>
            <Textarea id="notes" {...register("notes")} rows={3} />
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "تقارير التقدم" : "Progress Reports"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 no-print">
              <h3 className="font-semibold text-lg">{language === "ar" ? "إضافة تقرير جديد" : "Add New Report"}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="reportDate">{language === "ar" ? "التاريخ" : "Date"}</Label>
                  <Input
                    id="reportDate"
                    type="date"
                    value={newReport.date}
                    onChange={(e) => setNewReport((p) => ({ ...p, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reportProgress">{language === "ar" ? "التقدم (%)" : "Progress (%)"}</Label>
                  <Input
                    id="reportProgress"
                    type="number"
                    min="0"
                    max="100"
                    value={newReport.progress}
                    onChange={(e) => setNewReport((p) => ({ ...p, progress: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="reportNote">{language === "ar" ? "الملاحظة" : "Description"}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="reportNote"
                      value={newReport.note}
                      onChange={(e) => setNewReport((p) => ({ ...p, note: e.target.value }))}
                      placeholder={language === "ar" ? "وصف التحديث" : "Progress description"}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={addProgressReport}
                      disabled={progressMutation.isPending || !newReport.note}
                      className="btn btn-primary whitespace-nowrap"
                    >
                      {progressMutation.isPending ? "..." : language === "ar" ? "إضافة تقرير" : "Add Report"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="font-semibold text-lg">{language === "ar" ? "سجل التقارير" : "Report History"}</h3>
              {progressUpdates.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  {language === "ar" ? "لا يوجد تقارير بعد" : "No reports yet"}
                </div>
              ) : (
                <div className="space-y-3">
                  {[...progressUpdates].reverse().map((report, idx) => (
                    <div
                      key={report._id || idx}
                      className="flex items-center justify-between p-4 border border-border rounded-xl bg-card"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-medium text-foreground whitespace-pre-wrap">
                          {report.note || "-"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleString(
                                language === "ar" ? "ar-SA" : "en-US"
                              )
                            : "-"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <CircleProgress
                          value={report.progress || 0}
                          maxValue={100}
                          size={48}
                          strokeWidth={4}
                        />
                        <span className="font-semibold text-lg">{report.progress || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
