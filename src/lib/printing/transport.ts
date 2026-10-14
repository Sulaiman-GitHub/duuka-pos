"use client";

import { receiptToEscPos } from "./escpos";
import type { ReceiptData } from "./types";

export type PrinterMode = "browser" | "usb" | "bluetooth";
export type PrinterPrefs = { mode: PrinterMode; auto: boolean };

const KEY = "duuka-printer";
export function getPrinterPrefs(): PrinterPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PrinterPrefs>;
    return { mode: p.mode === "usb" || p.mode === "bluetooth" ? p.mode : "browser", auto: !!p.auto };
  } catch { return { mode: "browser", auto: false }; }
}
export function setPrinterPrefs(p: PrinterPrefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } }

// Minimal shapes of the WebUSB / Web Bluetooth APIs (not in TypeScript's default library).
type UsbEndpoint = { endpointNumber: number; direction: "in" | "out"; type: string };
type UsbDevice = {
  productName?: string; opened: boolean; configuration: { interfaces: { interfaceNumber: number; alternates: { interfaceClass: number; endpoints: UsbEndpoint[] }[] }[] } | null;
  open(): Promise<void>; selectConfiguration(n: number): Promise<void>; claimInterface(n: number): Promise<void>; transferOut(ep: number, data: BufferSource): Promise<unknown>;
};
type UsbApi = { requestDevice(o: unknown): Promise<UsbDevice>; getDevices(): Promise<UsbDevice[]> };
type BleChar = { properties: { write: boolean; writeWithoutResponse: boolean }; writeValueWithoutResponse?(d: BufferSource): Promise<void>; writeValue(d: BufferSource): Promise<void> };
type BleService = { getCharacteristics(): Promise<BleChar[]> };
type BleServer = { getPrimaryServices(): Promise<BleService[]>; connected: boolean };
type BleDevice = { name?: string; gatt?: { connect(): Promise<BleServer> } };
type BleApi = { requestDevice(o: unknown): Promise<BleDevice> };

// Services that common Bluetooth receipt printers expose for printing.
const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb", "0000fee7-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455", "38eb4a80-c570-11e3-9507-0002a5d5c51b",
];

let usbDevice: UsbDevice | undefined;
let bleDevice: BleDevice | undefined;

export const usbSupported = () => typeof navigator !== "undefined" && "usb" in navigator;
export const bluetoothSupported = () => typeof navigator !== "undefined" && "bluetooth" in navigator;

export async function connectUsb(): Promise<string> {
  const usb = (navigator as unknown as { usb: UsbApi }).usb;
  usbDevice = await usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
  return usbDevice.productName ?? "USB printer";
}
export async function connectBluetooth(): Promise<string> {
  const ble = (navigator as unknown as { bluetooth: BleApi }).bluetooth;
  bleDevice = await ble.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
  return bleDevice.name ?? "Bluetooth printer";
}

async function sendUsb(bytes: Uint8Array) {
  const usb = (navigator as unknown as { usb: UsbApi }).usb;
  const dev = usbDevice ?? (await usb.getDevices())[0]; // a printer the user already allowed on this device
  if (!dev) throw new Error("No USB printer connected.");
  if (!dev.opened) await dev.open();
  if (!dev.configuration) await dev.selectConfiguration(1);
  const ifaces = dev.configuration!.interfaces;
  const target = ifaces.flatMap((i) => i.alternates.map((a) => ({ i, a }))).find(({ a }) => a.endpoints.some((e) => e.direction === "out"))
    ?? (() => { throw new Error("This USB device has no output endpoint."); })();
  await dev.claimInterface(target.i.interfaceNumber);
  const ep = target.a.endpoints.find((e) => e.direction === "out")!;
  usbDevice = dev;
  for (let i = 0; i < bytes.length; i += 4096) await dev.transferOut(ep.endpointNumber, bytes.slice(i, i + 4096));
}

async function sendBluetooth(bytes: Uint8Array) {
  if (!bleDevice?.gatt) throw new Error("No Bluetooth printer connected. Press Connect first.");
  const server = await bleDevice.gatt.connect();
  let writer: BleChar | undefined;
  for (const svc of await server.getPrimaryServices()) {
    writer = (await svc.getCharacteristics()).find((c) => c.properties.write || c.properties.writeWithoutResponse);
    if (writer) break;
  }
  if (!writer) throw new Error("Couldn't find a way to print to this Bluetooth device.");
  for (let i = 0; i < bytes.length; i += 100) { // small chunks: Bluetooth printers have tiny buffers
    const chunk = bytes.slice(i, i + 100);
    if (writer.properties.writeWithoutResponse && writer.writeValueWithoutResponse) await writer.writeValueWithoutResponse(chunk);
    else await writer.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Prints with the device's chosen method. Direct printing falls back to the normal print dialog if it fails. */
export async function printReceipt(data: ReceiptData): Promise<{ via: "direct" | "browser"; note?: string }> {
  const { mode } = getPrinterPrefs();
  if (mode !== "browser") {
    try {
      const bytes = receiptToEscPos(data);
      await (mode === "usb" ? sendUsb(bytes) : sendBluetooth(bytes));
      return { via: "direct" };
    } catch (e) {
      window.print();
      return { via: "browser", note: `Direct printing failed (${e instanceof Error ? e.message : "unknown error"}), so the print dialog was opened instead.` };
    }
  }
  window.print();
  return { via: "browser" };
}

export async function testPrint(data: ReceiptData) { return printReceipt(data); }
