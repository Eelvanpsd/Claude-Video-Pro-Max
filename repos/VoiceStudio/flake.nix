{
  description = "VoiceStudio — Open-source, local-first voice cloning and speech generation studio";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs supportedSystems (system: f (import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
        };
      }));

      # Native libraries Electron and the Python wheels load at runtime on Linux.
      linuxLibsFor = pkgs: with pkgs; [
        alsa-lib
        at-spi2-atk
        at-spi2-core
        atk
        cairo
        cups
        dbus
        expat
        glib
        gtk3
        libGL
        libdrm
        libgbm
        libpulseaudio
        libx11
        libxkbcommon
        libxcomposite
        libxdamage
        libxext
        libxfixes
        libxrandr
        libxcb
        libxtst
        mesa
        nspr
        nss
        openssl
        pango
        systemd
        vulkan-loader
        wayland
        xdotool
        zlib
      ];

      nativeDepsFor = pkgs:
        if pkgs.stdenv.hostPlatform.isDarwin then [ pkgs.apple-sdk ] else linuxLibsFor pkgs;

      commonPackagesFor = pkgs: (with pkgs; [
        bun
        nodejs_22
        uv
        rustc
        cargo
        pkg-config
        ffmpeg
        git
      ]) ++ nativeDepsFor pkgs;
    in
    {
      devShells = forAllSystems (pkgs:
        let
          env = self.packages.${pkgs.stdenv.hostPlatform.system} or {};
          linuxLibs = linuxLibsFor pkgs;
          commonPackages = commonPackagesFor pkgs;
        in
        {
          default = pkgs.mkShell {
            packages = commonPackages;

            shellHook = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''
              export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath linuxLibs}''${LD_LIBRARY_PATH:+:}$LD_LIBRARY_PATH"
              export PKG_CONFIG_PATH="${pkgs.lib.makeSearchPathOutput "dev" "lib/pkgconfig" commonPackages}''${PKG_CONFIG_PATH:+:}$PKG_CONFIG_PATH"
            '';
          };
        } // pkgs.lib.optionalAttrs (env ? fhs) {
          fhs = env.fhs.env;
        }
      );

      packages = forAllSystems (pkgs:
        let
          fhsEnv = pkgs.buildFHSEnv {
            name = "voicestudio-fhs";
            targetPkgs = pkgs: commonPackagesFor pkgs ++ (with pkgs; [
              gcc
              gnumake
              binutils
              zsync
              zlib
            ]);
            # uv must use its own managed CPython, not a Nix store Python.
            # No OMNIVOICE_PORT here: an explicit port disables the app's
            # fallback when the default backend port is reserved.
            profile = ''
              export UV_PYTHON_PREFERENCE="only-managed"
            '';
            # Headers and .pc files for native builds inside the FHS env.
            extraOutputsToInstall = [ "dev" ];
            runScript = "bash";
          };
        in
        pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          default = fhsEnv;
          fhs = fhsEnv;
        }
      );
    };
}
