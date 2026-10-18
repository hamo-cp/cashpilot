package com.cashpilot.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.BridgeActivity;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    private String pendingBackupJson = null;
    private WebView printWebView = null;

    private final ActivityResultLauncher<Intent> createBackupDocumentLauncher =
        registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                final String payload = pendingBackupJson;
                pendingBackupJson = null;
                if (result.getResultCode() != Activity.RESULT_OK || payload == null) {
                    return;
                }
                Intent data = result.getData();
                Uri uri = data != null ? data.getData() : null;
                if (uri == null) {
                    return;
                }
                try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                    if (out != null) {
                        out.write(payload.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    }
                } catch (Exception ignored) {
                    // User or system cancelled/rejected write
                }
            }
        );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new CashPilotNativeBridge(), "CashPilotAndroid");
        }

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (getBridge() == null || getBridge().getWebView() == null) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                        return;
                    }
                    getBridge()
                        .getWebView()
                        .evaluateJavascript(
                            "(function(){ return Boolean(window.App && typeof window.App.handleAndroidBack === 'function' && window.App.handleAndroidBack()); })()",
                            value -> {
                                if (!"true".equals(value)) {
                                    setEnabled(false);
                                    getOnBackPressedDispatcher().onBackPressed();
                                    setEnabled(true);
                                }
                            }
                        );
                }
            }
        );
    }

    public final class CashPilotNativeBridge {

        @JavascriptInterface
        public boolean saveJsonBackup(String filename, String jsonContent) {
            if (jsonContent == null || jsonContent.isEmpty()) {
                return false;
            }
            String safeName = (filename == null || filename.trim().isEmpty())
                ? "cashpilot-backup.json"
                : filename.replaceAll("[^a-zA-Z0-9._-]", "_");
            if (!safeName.endsWith(".json")) {
                safeName = safeName + ".json";
            }
            try {
                pendingBackupJson = jsonContent;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, safeName);
                createBackupDocumentLauncher.launch(intent);
                return true;
            } catch (Exception ex) {
                pendingBackupJson = null;
                return false;
            }
        }

        @JavascriptInterface
        public boolean printHtml(String jobTitle, String htmlContent) {
            if (htmlContent == null || htmlContent.isEmpty()) {
                return false;
            }
            final String safeTitle = (jobTitle == null || jobTitle.trim().isEmpty())
                ? "CashPilot Summary"
                : jobTitle;
            runOnUiThread(() -> {
                try {
                    WebView webView = new WebView(MainActivity.this);
                    webView.getSettings().setJavaScriptEnabled(false);
                    printWebView = webView;
                    webView.setWebViewClient(
                        new WebViewClient() {
                            @Override
                            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                                return false;
                            }

                            @Override
                            public void onPageFinished(WebView view, String url) {
                                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                if (printManager != null) {
                                    PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(safeTitle);
                                    printManager.print(safeTitle, adapter, new PrintAttributes.Builder().build());
                                }
                                printWebView = null;
                            }
                        }
                    );
                    webView.loadDataWithBaseURL("https://localhost/", htmlContent, "text/html", "UTF-8", null);
                } catch (Exception ignored) {
                    printWebView = null;
                }
            });
            return true;
        }
    }
}
