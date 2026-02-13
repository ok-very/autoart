; Inno Setup script for AutoHelper installer

#define MyAppName "AutoHelper"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Ballard Fine Art"
#define MyAppURL "https://github.com/ballardfineart/autoart"
#define MyAppExeName "autohelper.exe"
#define MyAppTrayExeName "autohelper-tray.exe"

[Setup]
AppId={{B4LL4RD-AUT0-H3LP-3R00-1NST4LL3R00}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=AutoHelper-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installservice"; Description: "Install and start Windows service"; GroupDescription: "Service:"; Flags: checkedonce

[Files]
; Main application files from PyInstaller output
Source: "..\dist\autohelper\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Environment template
Source: "..\env.template"; DestDir: "{app}"; DestName: ".env.template"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName} Tray"; Filename: "{app}\{#MyAppTrayExeName}"; Comment: "Start AutoHelper in system tray"
Name: "{group}\{#MyAppName} Dashboard"; Filename: "http://127.0.0.1:8100/dashboard"; Comment: "Open AutoHelper Dashboard"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppTrayExeName}"; Tasks: desktopicon

[Run]
; Install and start Windows service if selected
Filename: "{app}\{#MyAppExeName}"; Parameters: "--service install"; StatusMsg: "Installing Windows service..."; Tasks: installservice; Flags: runhidden waituntilterminated
Filename: "net"; Parameters: "start AutoHelper"; StatusMsg: "Starting AutoHelper service..."; Tasks: installservice; Flags: runhidden waituntilterminated

; Offer to open dashboard after install
Filename: "http://127.0.0.1:8100/dashboard"; Description: "Open AutoHelper Dashboard"; Flags: postinstall shellexec nowait skipifsilent unchecked

[UninstallRun]
; Stop and remove service on uninstall
Filename: "net"; Parameters: "stop AutoHelper"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "--service remove"; Flags: runhidden waituntilterminated

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Create data directory if it doesn't exist
    ForceDirectories(ExpandConstant('{localappdata}\AutoHelper\data'));
  end;
end;
