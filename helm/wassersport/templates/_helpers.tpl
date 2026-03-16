{{/*
Expand the name of the chart.
*/}}
{{- define "wassersport.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "wassersport.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label.
*/}}
{{- define "wassersport.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "wassersport.labels" -}}
helm.sh/chart: {{ include "wassersport.chart" . }}
{{ include "wassersport.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "wassersport.selectorLabels" -}}
app.kubernetes.io/name: {{ include "wassersport.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
App service account name.
*/}}
{{- define "wassersport.serviceAccountName.app" -}}
{{- include "wassersport.fullname" . }}-app
{{- end }}

{{/*
DB service account name.
*/}}
{{- define "wassersport.serviceAccountName.db" -}}
{{- include "wassersport.fullname" . }}-db
{{- end }}

{{/*
App image tag: explicit value overrides, else fallback to appVersion.
*/}}
{{- define "wassersport.appImage" -}}
{{- printf "%s:%s" .Values.app.image.repository (.Values.app.image.tag | default .Chart.AppVersion) }}
{{- end }}
