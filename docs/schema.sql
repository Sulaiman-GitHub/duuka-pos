--
-- PostgreSQL database dump
--

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'CASH',
    'MOBILE_MONEY',
    'CARD',
    'BANK_TRANSFER'
);

--
-- Name: PurchaseOrderStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PurchaseOrderStatus" AS ENUM (
    'DRAFT',
    'ORDERED',
    'RECEIVED',
    'CANCELLED'
);

--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'MANAGER',
    'CASHIER'
);

--
-- Name: SaleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SaleStatus" AS ENUM (
    'COMPLETED',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
);

--
-- Name: StockMovementType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockMovementType" AS ENUM (
    'INITIAL',
    'PURCHASE',
    'SALE',
    'RETURN',
    'ADJUSTMENT_ADD',
    'ADJUSTMENT_REMOVE',
    'DAMAGE'
);

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "userId" text,
    action text NOT NULL,
    entity text,
    "entityId" text,
    detail text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Product" (
    id text NOT NULL,
    sku text NOT NULL,
    barcode text,
    name text NOT NULL,
    description text,
    "categoryId" text,
    "costPrice" integer NOT NULL,
    "sellPrice" integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    "minStock" integer DEFAULT 5 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "imageData" bytea,
    "imageType" text
);

--
-- Name: PurchaseOrder; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrder" (
    id text NOT NULL,
    "poNumber" text NOT NULL,
    "supplierId" text NOT NULL,
    status public."PurchaseOrderStatus" DEFAULT 'DRAFT'::public."PurchaseOrderStatus" NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    note text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "receivedAt" timestamp(3) without time zone,
    "invoiceNo" text
);

--
-- Name: PurchaseOrderItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PurchaseOrderItem" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "productId" text NOT NULL,
    quantity integer NOT NULL,
    "unitCost" integer NOT NULL,
    "receivedQty" integer DEFAULT 0 NOT NULL
);

--
-- Name: ReceiptCounter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReceiptCounter" (
    day text NOT NULL,
    last integer NOT NULL
);

--
-- Name: Sale; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Sale" (
    id text NOT NULL,
    "receiptNo" text NOT NULL,
    "cashierId" text NOT NULL,
    "customerName" text,
    "customerPhone" text,
    subtotal integer NOT NULL,
    discount integer DEFAULT 0 NOT NULL,
    total integer NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    "amountPaid" integer NOT NULL,
    "changeGiven" integer DEFAULT 0 NOT NULL,
    status public."SaleStatus" DEFAULT 'COMPLETED'::public."SaleStatus" NOT NULL,
    note text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: SaleItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaleItem" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "productId" text NOT NULL,
    "productName" text NOT NULL,
    sku text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" integer NOT NULL,
    "unitCost" integer NOT NULL,
    "lineDiscount" integer DEFAULT 0 NOT NULL,
    "lineTotal" integer NOT NULL
);

--
-- Name: SaleReturn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaleReturn" (
    id text NOT NULL,
    "saleId" text NOT NULL,
    "processedBy" text NOT NULL,
    reason text,
    "refundTotal" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: SaleReturnItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SaleReturnItem" (
    id text NOT NULL,
    "returnId" text NOT NULL,
    "saleItemId" text NOT NULL,
    quantity integer NOT NULL,
    "refundAmount" integer NOT NULL
);

--
-- Name: ShopSettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShopSettings" (
    id text DEFAULT 'main'::text NOT NULL,
    name text NOT NULL,
    address text NOT NULL,
    phone text NOT NULL,
    "receiptFooter" text NOT NULL,
    "cashierMaxDiscountPercent" integer DEFAULT 10 NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: StockMovement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."StockMovement" (
    id text NOT NULL,
    "productId" text NOT NULL,
    type public."StockMovementType" NOT NULL,
    quantity integer NOT NULL,
    "stockAfter" integer NOT NULL,
    reason text,
    reference text,
    "userId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: Supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Supplier" (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    address text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."Role" DEFAULT 'CASHIER'::public."Role" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);

--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);

--
-- Name: Product Product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_pkey" PRIMARY KEY (id);

--
-- Name: PurchaseOrderItem PurchaseOrderItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY (id);

--
-- Name: PurchaseOrder PurchaseOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY (id);

--
-- Name: ReceiptCounter ReceiptCounter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReceiptCounter"
    ADD CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY (day);

--
-- Name: SaleItem SaleItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_pkey" PRIMARY KEY (id);

--
-- Name: SaleReturnItem SaleReturnItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturnItem"
    ADD CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY (id);

--
-- Name: SaleReturn SaleReturn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturn"
    ADD CONSTRAINT "SaleReturn_pkey" PRIMARY KEY (id);

--
-- Name: Sale Sale_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_pkey" PRIMARY KEY (id);

--
-- Name: ShopSettings ShopSettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShopSettings"
    ADD CONSTRAINT "ShopSettings_pkey" PRIMARY KEY (id);

--
-- Name: StockMovement StockMovement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_pkey" PRIMARY KEY (id);

--
-- Name: Supplier Supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supplier"
    ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY (id);

--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);

--
-- Name: AuditLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_createdAt_idx" ON public."AuditLog" USING btree (action, "createdAt");

--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");

--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);

--
-- Name: Product_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_barcode_key" ON public."Product" USING btree (barcode);

--
-- Name: Product_categoryId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_categoryId_idx" ON public."Product" USING btree ("categoryId");

--
-- Name: Product_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Product_name_idx" ON public."Product" USING btree (name);

--
-- Name: Product_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Product_sku_key" ON public."Product" USING btree (sku);

--
-- Name: PurchaseOrder_poNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON public."PurchaseOrder" USING btree ("poNumber");

--
-- Name: SaleItem_productId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_productId_idx" ON public."SaleItem" USING btree ("productId");

--
-- Name: SaleItem_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleItem_saleId_idx" ON public."SaleItem" USING btree ("saleId");

--
-- Name: SaleReturn_saleId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SaleReturn_saleId_idx" ON public."SaleReturn" USING btree ("saleId");

--
-- Name: Sale_cashierId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_cashierId_createdAt_idx" ON public."Sale" USING btree ("cashierId", "createdAt");

--
-- Name: Sale_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_createdAt_idx" ON public."Sale" USING btree ("createdAt");

--
-- Name: Sale_paymentMethod_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Sale_paymentMethod_idx" ON public."Sale" USING btree ("paymentMethod");

--
-- Name: Sale_receiptNo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Sale_receiptNo_key" ON public."Sale" USING btree ("receiptNo");

--
-- Name: StockMovement_productId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "StockMovement_productId_createdAt_idx" ON public."StockMovement" USING btree ("productId", "createdAt");

--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);

--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: Product Product_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Product"
    ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: PurchaseOrderItem PurchaseOrderItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."PurchaseOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: PurchaseOrderItem PurchaseOrderItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrderItem"
    ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: PurchaseOrder PurchaseOrder_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: PurchaseOrder PurchaseOrder_supplierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES public."Supplier"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: SaleItem SaleItem_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: SaleItem SaleItem_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleItem"
    ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: SaleReturnItem SaleReturnItem_returnId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturnItem"
    ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES public."SaleReturn"(id) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: SaleReturnItem SaleReturnItem_saleItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturnItem"
    ADD CONSTRAINT "SaleReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES public."SaleItem"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: SaleReturn SaleReturn_processedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturn"
    ADD CONSTRAINT "SaleReturn_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: SaleReturn SaleReturn_saleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SaleReturn"
    ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES public."Sale"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: Sale Sale_cashierId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Sale"
    ADD CONSTRAINT "Sale_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: StockMovement StockMovement_productId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES public."Product"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

--
-- Name: StockMovement StockMovement_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."StockMovement"
    ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- PostgreSQL database dump complete
--

