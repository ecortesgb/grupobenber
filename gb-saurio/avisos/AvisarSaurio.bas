Attribute VB_Name = "AvisarSaurio"
' Le manda un aviso a GB Saurio desde cualquier macro de Excel.
' Importa este módulo (Alt+F11 > Archivo > Importar) y llama, por ejemplo:
'   AvisarSaurio "Reporte de ventas listo", "feliz", "Macro Ventas"
'   AvisarSaurio "Faltan tiendas en la base", "preocupado", "Macro Ventas", "Completar tiendas faltantes", "2026-10-09", "Alta"
' Si Saurio está apagado, la macro sigue sin error.
Option Explicit

Public Sub AvisarSaurio(ByVal texto As String, Optional ByVal estado As String = "alerta", _
                        Optional ByVal origen As String = "Excel", Optional ByVal pendiente As String = "", _
                        Optional ByVal fecha As String = "", Optional ByVal prioridad As String = "Media")
    On Error GoTo Fin
    Dim cuerpo As String, http As Object
    cuerpo = "{""texto"":""" & Json(texto) & """,""estado"":""" & Json(estado) & """,""origen"":""" & Json(origen) & """"
    If Len(pendiente) > 0 Then
        cuerpo = cuerpo & ",""pendiente"":{""titulo"":""" & Json(pendiente) & """,""prioridad"":""" & Json(prioridad) & """"
        If Len(fecha) > 0 Then cuerpo = cuerpo & ",""fecha_compromiso"":""" & Json(fecha) & """"
        cuerpo = cuerpo & "}"
    End If
    cuerpo = cuerpo & "}"

    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    http.setTimeouts 2000, 2000, 5000, 5000
    http.Open "POST", "http://127.0.0.1:7788/aviso", False
    http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.setRequestHeader "X-Saurio-Token", LeerToken()
    http.send cuerpo
Fin:
End Sub

Private Function LeerToken() As String
    Dim f As Integer
    f = FreeFile
    Open Environ$("USERPROFILE") & "\GbSaurio\buzon_token.txt" For Input As #f
    Line Input #f, LeerToken
    Close #f
    LeerToken = Trim$(LeerToken)
End Function

Private Function Json(ByVal s As String) As String
    s = Replace(s, "\", "\\")
    s = Replace(s, """", "\""")
    s = Replace(s, vbCrLf, "\n")
    s = Replace(s, vbCr, "\n")
    s = Replace(s, vbLf, "\n")
    Json = Replace(s, vbTab, "\t")
End Function
