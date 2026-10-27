' Inicia o monitor sem abrir janela de console.
' Usado pela tarefa agendada criada por install-startup.ps1.
Dim fso, shell, root
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = root

' 0 = janela oculta, False = nao espera terminar
shell.Run "cmd /c node """ & root & "\dist\index.js""", 0, False
