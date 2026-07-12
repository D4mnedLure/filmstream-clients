package com.filmstream.tv;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app self-update for sideloaded builds. installApk({url}) downloads the APK
 * to the app cache and hands it to the system package installer via the
 * FileProvider declared in the manifest. Requires REQUEST_INSTALL_PACKAGES;
 * on Android 8+ the OS prompts the user to allow installs from this app.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void installApk(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("missing url");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    File apk = new File(getContext().getCacheDir(), "update.apk");
                    download(url, apk, 5);
                    Uri uri = FileProvider.getUriForFile(
                            getContext(),
                            getContext().getPackageName() + ".fileprovider",
                            apk);
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(uri, "application/vnd.android.package-archive");
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    getContext().startActivity(intent);
                    call.resolve();
                } catch (Exception e) {
                    call.reject("update failed: " + e.getMessage(), e);
                }
            }
        }).start();
    }

    // Download to `out`, following redirects manually (GitHub asset URLs 302 to a
    // signed CDN URL, and HttpURLConnection won't auto-follow across protocols).
    private void download(String url, File out, int maxRedirects) throws Exception {
        if (maxRedirects < 0) throw new Exception("too many redirects");
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(false);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(60000);
        conn.connect();
        int code = conn.getResponseCode();
        if (code >= 300 && code < 400) {
            String loc = conn.getHeaderField("Location");
            conn.disconnect();
            if (loc == null) throw new Exception("redirect without Location");
            download(loc, out, maxRedirects - 1);
            return;
        }
        if (code != 200) {
            conn.disconnect();
            throw new Exception("HTTP " + code);
        }
        InputStream in = null;
        FileOutputStream fos = null;
        try {
            in = conn.getInputStream();
            fos = new FileOutputStream(out);
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
            fos.flush();
        } finally {
            if (fos != null) try { fos.close(); } catch (Exception ignored) {}
            if (in != null) try { in.close(); } catch (Exception ignored) {}
            conn.disconnect();
        }
    }
}
