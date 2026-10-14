# Receipt printers

Duuka POS prints receipts for the small **thermal roll printers** most shops use (58 mm and 80 mm paper).

## 1. Set the paper width (once per shop)

Settings → **Receipt paper width**: 58 mm (the small ones) or 80 mm. Check the label on the roll. Receipts, on screen and on paper, are laid out for that width.

## 2. Choose how this device prints (once per device)

Open any receipt (or the till after an offline sale) → **Printer settings**. These choices are saved on that device only, because each till has its own printer.

| Option | Works with | Notes |
|---|---|---|
| **Normal printing** (default) | Any printer installed on the device: USB on a PC, or Bluetooth/USB printers that your phone's print service handles | In the print dialog pick your roll size as the paper and turn off "Headers and footers". Works everywhere, including iPhone/iPad. |
| **Direct USB (beta)** | USB receipt printers, Chrome or Edge on PC/Android | Press *Connect printer*, pick it once, then *Test print*. Sends the receipt straight to the printer with no dialog. |
| **Direct Bluetooth (beta)** | Bluetooth receipt printers, Chrome on Android or PC (not iPhone) | Press *Connect printer* each time you open the app, then *Test print*. |

**Print automatically after each sale** prints without asking, using whichever option is selected.

The two *Direct* options are new and depend on the printer's make. If one fails, the app falls back to the normal print dialog and says so. Tell us the printer model if it doesn't work and we'll add support.

## Offline sales

A sale made with no internet prints a **provisional** receipt straight away (reference `OFF-XXXXXX`). Its real receipt number is assigned when the sale uploads; the printed copy and the system are matched by date, time and amount.
